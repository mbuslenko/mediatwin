import sharp from 'sharp';
import type { MediaSource } from '../../types';
import { sourceToBuffer } from '../../utils/file-utils';
import type { ImageData } from '../types';

export interface ProcessOptions {
  /** Target width */
  width: number;
  /** Target height */
  height: number;
  /** Convert to grayscale (default: true) */
  grayscale?: boolean;
}

/**
 * Process an image using Sharp for hash computation
 */
export class ImageProcessor {
  async process(source: MediaSource, options: ProcessOptions): Promise<ImageData> {
    const buffer = await sourceToBuffer(source);

    let pipeline = sharp(buffer).resize(options.width, options.height, {
      fit: 'fill',
      kernel: 'lanczos3',
    });

    if (options.grayscale !== false) {
      pipeline = pipeline.grayscale();
    }

    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });

    return {
      data: new Uint8Array(data),
      width: info.width,
      height: info.height,
      channels: info.channels,
    };
  }

  async getGrayscalePixels(source: MediaSource, size: number): Promise<number[]> {
    const imageData = await this.process(source, {
      width: size,
      height: size,
      grayscale: true,
    });

    return Array.from(imageData.data);
  }

  /**
   * Get RGB pixel values as a flat array [r,g,b,r,g,b,...]
   */
  async getRgbPixels(source: MediaSource, size: number): Promise<number[]> {
    const buffer = await sourceToBuffer(source);

    const { data } = await sharp(buffer)
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return Array.from(data);
  }

  async getMetadata(source: MediaSource): Promise<{
    width: number;
    height: number;
    format: string;
  }> {
    const buffer = await sourceToBuffer(source);
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  }
}

export const imageProcessor = new ImageProcessor();
