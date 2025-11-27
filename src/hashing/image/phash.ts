import type { HashSize, MediaSource } from '../../types';
import { bigIntToHex, computeMedian, hashSizeToGridSize, hashSizeToHexLength } from '../../utils/hash-utils';
import { imageProcessor } from './image-processor';
import type { HashResult, ImageHasher } from '../types';

/**
 * DCT (Discrete Cosine Transform) based Perceptual Hash
 *
 * Algorithm:
 * 1. Resize image to 32x32 (for 64-bit) or 64x64 (for 256-bit)
 * 2. Convert to grayscale
 * 3. Compute 2D DCT
 * 4. Extract top-left 8x8 or 16x16 (low frequencies)
 * 5. Compare values to median to generate hash
 */
export class PHasher implements ImageHasher {
  readonly name = 'phash';

  private readonly size: number;
  private readonly hashBits: HashSize;
  private readonly dctSize: number;
  private readonly cosTable: number[][];

  constructor(hashSize: HashSize = 64) {
    this.hashBits = hashSize;
    this.size = hashSizeToGridSize(hashSize); // 8 for 64-bit, 16 for 256-bit
    this.dctSize = this.size * 4; // 32x32 for 64-bit, 64x64 for 256-bit
    this.cosTable = this.precomputeCosineTable();
  }

  async compute(source: MediaSource): Promise<HashResult> {
    const startTime = performance.now();

    const pixels = await imageProcessor.getGrayscalePixels(source, this.dctSize);
    const dct = this.compute2DDCT(pixels);

    // extract low frequency components (top-left size x size)
    const lowFreq = this.extractLowFrequencies(dct);

    // compute median (excluding DC component at [0,0])
    const values = lowFreq.slice(1);
    const median = computeMedian(values);

    let hash = 0n;
    for (let i = 0; i < this.size * this.size; i++) {
      if (lowFreq[i] > median) {
        hash |= 1n << BigInt(i);
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      hash: bigIntToHex(hash, hashSizeToHexLength(this.hashBits)),
      processingTime,
    };
  }

  private precomputeCosineTable(): number[][] {
    const table: number[][] = [];

    for (let i = 0; i < this.dctSize; i++) {
      table[i] = [];
      for (let j = 0; j < this.dctSize; j++) {
        table[i][j] = Math.cos(((2 * i + 1) * j * Math.PI) / (2 * this.dctSize));
      }
    }

    return table;
  }

  private compute2DDCT(pixels: number[]): number[][] {
    const result: number[][] = Array(this.dctSize)
      .fill(null)
      .map(() => Array(this.dctSize).fill(0));

    // convert 1D pixels to 2D array
    const pixelMatrix: number[][] = [];
    for (let y = 0; y < this.dctSize; y++) {
      pixelMatrix[y] = [];
      for (let x = 0; x < this.dctSize; x++) {
        pixelMatrix[y][x] = pixels[y * this.dctSize + x];
      }
    }

    // compute DCT
    for (let u = 0; u < this.dctSize; u++) {
      for (let v = 0; v < this.dctSize; v++) {
        let sum = 0;

        for (let x = 0; x < this.dctSize; x++) {
          for (let y = 0; y < this.dctSize; y++) {
            sum += pixelMatrix[y][x] * this.cosTable[x][u] * this.cosTable[y][v];
          }
        }

        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;

        result[u][v] = (2 / this.dctSize) * cu * cv * sum;
      }
    }

    return result;
  }

  private extractLowFrequencies(dct: number[][]): number[] {
    const result: number[] = [];

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        result.push(dct[y][x]);
      }
    }

    return result;
  }
}

export async function computePHash(source: MediaSource, hashSize: HashSize = 64): Promise<string> {
  const hasher = new PHasher(hashSize);
  const result = await hasher.compute(source);
  return result.hash;
}
