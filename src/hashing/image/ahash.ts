import type { MediaSource } from '../../types';
import { bigIntToHex } from '../../utils/hash-utils';
import { imageProcessor } from './image-processor';
import type { HashResult, ImageHasher } from '../types';

/**
 * Average Hash
 *
 * Algorithm:
 * 1. Resize image to 8x8
 * 2. Convert to grayscale
 * 3. Compute average pixel value
 * 4. Generate hash: 1 if pixel > average, 0 otherwise
 *
 * The fastest and simplest perceptual hash.
 */
export class AHasher implements ImageHasher {
  readonly name = 'ahash';

  private readonly size: number;

  constructor(size: number = 8) {
    this.size = size;
  }

  async compute(source: MediaSource): Promise<HashResult> {
    const startTime = performance.now();

    const pixels = await imageProcessor.getGrayscalePixels(source, this.size);

    const sum = pixels.reduce((acc, val) => acc + val, 0);
    const average = sum / pixels.length;

    let hash = 0n;
    for (let i = 0; i < pixels.length && i < 64; i++) {
      if (pixels[i] > average) {
        hash |= 1n << BigInt(i);
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      hash: bigIntToHex(hash, 16),
      processingTime,
    };
  }
}

export async function computeAHash(source: MediaSource, size: number = 8): Promise<string> {
  const hasher = new AHasher(size);
  const result = await hasher.compute(source);
  return result.hash;
}
