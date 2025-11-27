import type { HashSize, MediaSource } from '../../types';
import { bigIntToHex, hashSizeToGridSize, hashSizeToHexLength } from '../../utils/hash-utils';
import { imageProcessor } from './image-processor';
import type { HashResult, ImageHasher } from '../types';

/**
 * Average Hash
 *
 * Algorithm:
 * 1. Resize image to 8x8 (64-bit) or 16x16 (256-bit)
 * 2. Convert to grayscale
 * 3. Compute average pixel value
 * 4. Generate hash: 1 if pixel > average, 0 otherwise
 *
 * The fastest and simplest perceptual hash.
 */
export class AHasher implements ImageHasher {
  readonly name = 'ahash';

  private readonly size: number;
  private readonly hashBits: HashSize;

  constructor(hashSize: HashSize = 64) {
    this.hashBits = hashSize;
    this.size = hashSizeToGridSize(hashSize);
  }

  async compute(source: MediaSource): Promise<HashResult> {
    const startTime = performance.now();

    const pixels = await imageProcessor.getGrayscalePixels(source, this.size);

    const sum = pixels.reduce((acc, val) => acc + val, 0);
    const average = sum / pixels.length;

    let hash = 0n;
    for (let i = 0; i < pixels.length && i < this.hashBits; i++) {
      if (pixels[i] > average) {
        hash |= 1n << BigInt(i);
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      hash: bigIntToHex(hash, hashSizeToHexLength(this.hashBits)),
      processingTime,
    };
  }
}

export async function computeAHash(source: MediaSource, hashSize: HashSize = 64): Promise<string> {
  const hasher = new AHasher(hashSize);
  const result = await hasher.compute(source);
  return result.hash;
}
