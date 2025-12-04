import sharp from 'sharp';
import type { AspectRatioMode, MediaSource } from '../../types';
import { sourceToBuffer } from '../../utils/file-utils';
import type { ImageData } from '../types';

export interface ProcessOptions {
  /** Target width */
  width: number;
  /** Target height */
  height: number;
  /** Convert to grayscale (default: true) */
  grayscale?: boolean;
  /** Aspect ratio handling mode (default: 'stretch') */
  aspectRatioMode?: AspectRatioMode;
}

/**
 * Process an image using Sharp for hash computation
 */
export class ImageProcessor {
  async process(source: MediaSource, options: ProcessOptions): Promise<ImageData> {
    const buffer = await sourceToBuffer(source);
    const mode = options.aspectRatioMode || 'stretch';

    let pipeline: sharp.Sharp;

    if (mode === 'stretch') {
      pipeline = sharp(buffer).resize(options.width, options.height, {
        fit: 'fill',
        kernel: 'lanczos3',
      });
    } else if (mode === 'crop') {
      pipeline = sharp(buffer).resize(options.width, options.height, {
        fit: 'cover',
        position: 'center',
        kernel: 'lanczos3',
      });
    } else {
      const { dominant } = await sharp(buffer).stats();

      pipeline = sharp(buffer).resize(options.width, options.height, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: {
          r: dominant.r,
          g: dominant.g,
          b: dominant.b,
        },
      });
    }

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

  async getGrayscalePixels(
    source: MediaSource,
    size: number,
    aspectRatioMode?: AspectRatioMode
  ): Promise<number[]> {
    const imageData = await this.process(source, {
      width: size,
      height: size,
      grayscale: true,
      aspectRatioMode,
    });

    return Array.from(imageData.data);
  }

  /**
   * Get RGB pixel values as a flat array [r,g,b,r,g,b,...]
   */
  async getRgbPixels(
    source: MediaSource,
    size: number,
    aspectRatioMode?: AspectRatioMode
  ): Promise<number[]> {
    const imageData = await this.process(source, {
      width: size,
      height: size,
      grayscale: false,
      aspectRatioMode,
    });

    // Remove alpha if present
    if (imageData.channels === 4) {
      const rgb: number[] = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        rgb.push(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]);
      }
      return rgb;
    }

    return Array.from(imageData.data);
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
