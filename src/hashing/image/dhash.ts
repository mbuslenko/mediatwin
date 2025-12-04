import type { AspectRatioMode, HashSize, MediaSource } from '../../types';
import { bigIntToHex, hashSizeToGridSize, hashSizeToHexLength } from '../../utils/hash-utils';
import { imageProcessor } from './image-processor';
import type { HashResult, ImageHasher } from '../types';

/**
 * Difference Hash (Gradient-based)
 *
 * Algorithm:
 * 1. Resize image to (size+1) x size (e.g., 9x8 for 64-bit, 17x16 for 256-bit)
 * 2. Convert to grayscale
 * 3. Compare adjacent horizontal pixels
 * 4. Generate hash: 1 if left > right, 0 otherwise
 *
 * This produces a 64-bit hash for 8x8 size, or 256-bit for 16x16.
 */
export class DHasher implements ImageHasher {
  readonly name = 'dhash';

  private readonly size: number;
  private readonly hashBits: HashSize;
  private readonly aspectRatioMode: AspectRatioMode;

  constructor(hashSize: HashSize = 64, aspectRatioMode: AspectRatioMode = 'stretch') {
    this.hashBits = hashSize;
    this.size = hashSizeToGridSize(hashSize);
    this.aspectRatioMode = aspectRatioMode;
  }

  async compute(source: MediaSource): Promise<HashResult> {
    const startTime = performance.now();

    const imageData = await imageProcessor.process(source, {
      width: this.size + 1,
      height: this.size,
      grayscale: true,
      aspectRatioMode: this.aspectRatioMode,
    });

    const pixels = imageData.data;
    let hash = 0n;
    let bitIndex = 0;

    // compare adjacent horizontal pixels
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const left = pixels[y * (this.size + 1) + x];
        const right = pixels[y * (this.size + 1) + x + 1];

        if (left > right) {
          hash |= 1n << BigInt(bitIndex);
        }
        bitIndex++;
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      hash: bigIntToHex(hash, hashSizeToHexLength(this.hashBits)),
      processingTime,
    };
  }
}

export async function computeDHash(
  source: MediaSource,
  hashSize: HashSize = 64,
  aspectRatioMode: AspectRatioMode = 'stretch'
): Promise<string> {
  const hasher = new DHasher(hashSize, aspectRatioMode);
  const result = await hasher.compute(source);
  return result.hash;
}
