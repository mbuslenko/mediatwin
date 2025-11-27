import type { MediaSource } from '../../types';
import { bigIntToHex, computeMedian } from '../../utils/hash-utils';
import { imageProcessor } from './image-processor';
import type { HashResult, ImageHasher } from '../types';

/**
 * Color Histogram Hash
 *
 * Algorithm:
 * 1. Resize image to 8x8
 * 2. Quantize colors to 4 bins per channel (64 total color bins)
 * 3. Build histogram of color occurrences
 * 4. Generate hash by comparing histogram values to median
 *
 * This hash captures color distribution rather than structure.
 */
export class ColorHasher implements ImageHasher {
  readonly name = 'colorHash';

  private readonly size: number;
  private readonly binsPerChannel: number;

  constructor(size: number = 8, binsPerChannel: number = 4) {
    this.size = size;
    this.binsPerChannel = binsPerChannel;
  }

  async compute(source: MediaSource): Promise<HashResult> {
    const startTime = performance.now();

    const pixels = await imageProcessor.getRgbPixels(source, this.size);

    // build color histogram (4 bins per channel = 64 total bins)
    const totalBins = this.binsPerChannel ** 3;
    const histogram = new Array(totalBins).fill(0);
    const binSize = 256 / this.binsPerChannel;

    // process RGB triplets
    for (let i = 0; i < pixels.length; i += 3) {
      const r = Math.floor(pixels[i] / binSize);
      const g = Math.floor(pixels[i + 1] / binSize);
      const b = Math.floor(pixels[i + 2] / binSize);

      const binIndex =
        r * this.binsPerChannel * this.binsPerChannel + g * this.binsPerChannel + b;

      histogram[binIndex]++;
    }

    // generate hash from histogram
    const median = computeMedian(histogram);
    let hash = 0n;

    for (let i = 0; i < 64; i++) {
      if (histogram[i] > median) {
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

export async function computeColorHash(source: MediaSource, size: number = 8): Promise<string> {
  const hasher = new ColorHasher(size);
  const result = await hasher.compute(source);
  return result.hash;
}
