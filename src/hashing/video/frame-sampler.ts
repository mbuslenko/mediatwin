import type { HashAlgorithm } from '../../types/config';
import type { ComputedHashes, FrameHash } from '../../types/media';
import { PHasher } from '../image/phash';
import { DHasher } from '../image/dhash';
import { AHasher } from '../image/ahash';
import { ColorHasher } from '../image/color-hash';
import { videoProcessor } from './video-processor';

export interface FrameSamplerOptions {
  /** Seconds between frame extractions */
  interval: number;
  /** Maximum number of frames to extract */
  maxFrames: number;
  /** Hash algorithms to use */
  hashAlgorithms: HashAlgorithm[];
}

/**
 * Extract frames from videos at fixed intervals and hash them
 */
export class FrameSampler {
  private options: FrameSamplerOptions;
  private hashers: Map<HashAlgorithm, { compute: (buffer: Buffer) => Promise<{ hash: string }> }>;

  constructor(options: FrameSamplerOptions) {
    this.options = options;

    this.hashers = new Map();

    if (options.hashAlgorithms.includes('phash')) {
      this.hashers.set('phash', new PHasher());
    }
    if (options.hashAlgorithms.includes('dhash')) {
      this.hashers.set('dhash', new DHasher());
    }
    if (options.hashAlgorithms.includes('ahash')) {
      this.hashers.set('ahash', new AHasher());
    }
    if (options.hashAlgorithms.includes('colorHash')) {
      this.hashers.set('colorHash', new ColorHasher());
    }
  }

  async extractAndHash(videoPath: string): Promise<FrameHash[]> {
    const metadata = await videoProcessor.getMetadata(videoPath);

    const timestamps = videoProcessor.calculateTimestamps(
      metadata.duration,
      this.options.interval,
      this.options.maxFrames
    );

    if (timestamps.length === 0) {
      return [];
    }

    const frames = await videoProcessor.extractFrames(videoPath, timestamps);
    const frameHashes: FrameHash[] = [];

    for (const [timestamp, frameBuffer] of frames) {
      const hashes = await this.computeHashes(frameBuffer);

      frameHashes.push({
        timestamp,
        hashes,
      });
    }

    return frameHashes;
  }

  private async computeHashes(frameBuffer: Buffer): Promise<ComputedHashes> {
    const hashes: ComputedHashes = {};

    for (const [algo, hasher] of this.hashers) {
      try {
        const result = await hasher.compute(frameBuffer);
        hashes[algo] = result.hash;
      } catch (err) {
        console.warn(`Failed to compute ${algo} for frame: ${err}`);
      }
    }

    return hashes;
  }
}
