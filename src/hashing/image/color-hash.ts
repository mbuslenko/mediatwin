import type { HashSize, MediaSource } from '../../types';
import { bigIntToHex, computeMedian, hashSizeToHexLength } from '../../utils/hash-utils';
import { imageProcessor } from './image-processor';
import type { HashResult, ImageHasher } from '../types';

/**
 * Color Histogram Hash
 *
 * Algorithm for 64-bit:
 * 1. Resize image to 8x8
 * 2. Quantize colors to 4 bins per channel (64 total color bins)
 * 3. Build histogram of color occurrences
 * 4. Generate hash by comparing histogram values to median
 *
 * Algorithm for 256-bit:
 * 1. Resize image to 16x16
 * 2. Divide into 4 quadrants (8x8 each)
 * 3. Build 64-bin histogram for each quadrant
 * 4. Combine into 256-bit hash (64 bits per quadrant)
 *
 * This hash captures color distribution rather than structure.
 */
export class ColorHasher implements ImageHasher {
  readonly name = 'colorHash';

  private readonly hashBits: HashSize;
  private readonly binsPerChannel: number;

  constructor(hashSize: HashSize = 64, binsPerChannel: number = 4) {
    this.hashBits = hashSize;
    this.binsPerChannel = binsPerChannel;
  }

  async compute(source: MediaSource): Promise<HashResult> {
    const startTime = performance.now();

    if (this.hashBits === 256) {
      return this.compute256bit(source, startTime);
    }

    return this.compute64bit(source, startTime);
  }

  private async compute64bit(source: MediaSource, startTime: number): Promise<HashResult> {
    const pixels = await imageProcessor.getRgbPixels(source, 8);
    const hash = this.computeHistogramHash(pixels);
    const processingTime = performance.now() - startTime;

    return {
      hash: bigIntToHex(hash, 16),
      processingTime,
    };
  }

  private async compute256bit(source: MediaSource, startTime: number): Promise<HashResult> {
    const imageData = await imageProcessor.process(source, {
      width: 16,
      height: 16,
      grayscale: false,
    });

    const pixels = imageData.data;
    let combinedHash = 0n;

    // process 4 quadrants (each 8x8)
    const quadrants = [
      { startX: 0, startY: 0 },   // top-left
      { startX: 8, startY: 0 },   // top-right
      { startX: 0, startY: 8 },   // bottom-left
      { startX: 8, startY: 8 },   // bottom-right
    ];

    for (let q = 0; q < 4; q++) {
      const { startX, startY } = quadrants[q];
      const quadrantPixels: number[] = [];

      // extract quadrant pixels
      for (let y = startY; y < startY + 8; y++) {
        for (let x = startX; x < startX + 8; x++) {
          const idx = (y * 16 + x) * 3;
          quadrantPixels.push(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
        }
      }

      const quadrantHash = this.computeHistogramHash(new Uint8Array(quadrantPixels));
      combinedHash |= quadrantHash << BigInt(q * 64);
    }

    const processingTime = performance.now() - startTime;

    return {
      hash: bigIntToHex(combinedHash, hashSizeToHexLength(this.hashBits)),
      processingTime,
    };
  }

  private computeHistogramHash(pixels: Uint8Array | number[]): bigint {
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

    return hash;
  }
}

export async function computeColorHash(source: MediaSource, hashSize: HashSize = 64): Promise<string> {
  const hasher = new ColorHasher(hashSize);
  const result = await hasher.compute(source);
  return result.hash;
}
