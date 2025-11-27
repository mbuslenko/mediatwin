import sharp from 'sharp';
import { videoProcessor } from './video-processor';
import { bigIntToHex, computeMedian } from '../../utils/hash-utils';

const FRAME_SIZE = 144;
const COLLAGE_HASH_SIZE = 8;

/**
 * Video Hash (vHash) - Collage-based video fingerprint
 *
 * Algorithm (based on Python videohash):
 * 1. Extract frames at 1-second intervals
 * 2. Resize each frame to 144x144
 * 3. Create a collage of all frames
 * 4. Compute perceptual hash of the collage
 * 5. Combine with dominant color pattern
 *
 */
export class VHasher {
  private frameInterval: number;
  private maxFrames: number;

  constructor(frameInterval: number = 1, maxFrames: number = 64) {
    this.frameInterval = frameInterval;
    this.maxFrames = maxFrames;
  }

  async compute(videoPath: string): Promise<string> {
    const metadata = await videoProcessor.getMetadata(videoPath);

    const timestamps = videoProcessor.calculateTimestamps(
      metadata.duration,
      this.frameInterval,
      this.maxFrames
    );
    if (timestamps.length === 0) {
      throw new Error('Video is too short to extract frames');
    }

    const frames = await videoProcessor.extractFrames(videoPath, timestamps);
    if (frames.size === 0) {
      throw new Error('Failed to extract any frames from video');
    }

    // resize all frames
    const resizedFrames: Buffer[] = [];
    for (const frameBuffer of frames.values()) {
      const resized = await this.resizeFrame(frameBuffer);
      resizedFrames.push(resized);
    }

    const collage = await this.createCollage(resizedFrames);
    const collageHash = await this.computeCollageHash(collage);

    const colorPattern = await this.computeColorPattern(resizedFrames);

    const finalHash = this.xorHashes(collageHash, colorPattern);

    return finalHash;
  }

  private async resizeFrame(frameBuffer: Buffer): Promise<Buffer> {
    return sharp(frameBuffer)
      .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'fill' })
      .png()
      .toBuffer();
  }

  private async createCollage(frames: Buffer[]): Promise<Buffer> {
    const count = frames.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const collageWidth = cols * FRAME_SIZE;
    const collageHeight = rows * FRAME_SIZE;

    // composite operations
    const composites = frames.map((frame, i) => ({
      input: frame,
      left: (i % cols) * FRAME_SIZE,
      top: Math.floor(i / cols) * FRAME_SIZE,
    }));

    // create collage with black background
    return sharp({
      create: {
        width: collageWidth,
        height: collageHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  }

  private async computeCollageHash(collage: Buffer): Promise<string> {
    // resize to hash size and convert to grayscale
    const { data } = await sharp(collage)
      .resize(COLLAGE_HASH_SIZE, COLLAGE_HASH_SIZE, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data);
    const median = computeMedian(pixels);

    let hash = 0n;
    for (let i = 0; i < pixels.length && i < 64; i++) {
      if (pixels[i] > median) {
        hash |= 1n << BigInt(i);
      }
    }

    return bigIntToHex(hash, 16);
  }

  /**
   * Get dominant color pattern across frames
   */
  private async computeColorPattern(frames: Buffer[]): Promise<string> {
    const colors: number[] = [];

    for (const frame of frames) {
      const { data } = await sharp(frame)
        .resize(4, 4, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      let r = 0,
        g = 0,
        b = 0;
      for (let i = 0; i < data.length; i += 3) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }

      const pixels = data.length / 3;
      colors.push(Math.floor(r / pixels));
      colors.push(Math.floor(g / pixels));
      colors.push(Math.floor(b / pixels));
    }

    const median = computeMedian(colors);
    let hash = 0n;

    for (let i = 0; i < Math.min(colors.length, 64); i++) {
      if (colors[i] > median) {
        hash |= 1n << BigInt(i);
      }
    }

    return bigIntToHex(hash, 16);
  }

  private xorHashes(hash1: string, hash2: string): string {
    const h1 = BigInt('0x' + hash1);
    const h2 = BigInt('0x' + hash2);
    const result = h1 ^ h2;
    return bigIntToHex(result, 16);
  }
}

export async function computeVHash(
  videoPath: string,
  frameInterval: number = 1,
  maxFrames: number = 64
): Promise<string> {
  const hasher = new VHasher(frameInterval, maxFrames);
  return hasher.compute(videoPath);
}
