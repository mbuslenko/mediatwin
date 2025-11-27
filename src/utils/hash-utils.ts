import type { HashSize } from '../types';

export function hexToBigInt(hex: string): bigint {
  return BigInt('0x' + hex);
}

/**
 * Convert hash size in bits to grid dimension
 * 64 bits = 8x8 grid, 256 bits = 16x16 grid
 */
export function hashSizeToGridSize(hashSize: HashSize): number {
  return hashSize === 256 ? 16 : 8;
}

/**
 * Convert hash size in bits to hex string length
 * 64 bits = 16 hex chars, 256 bits = 64 hex chars
 */
export function hashSizeToHexLength(hashSize: HashSize): number {
  return hashSize === 256 ? 64 : 16;
}

export function detectHashSize(hashHex: string): HashSize {
  return hashHex.length > 16 ? 256 : 64;
}

export function bigIntToHex(value: bigint, padLength: number = 16): string {
  return value.toString(16).padStart(padLength, '0');
}

/**
 * For calculating distance between two hex hash strings
 * it uses Brian Kernighan's algorithm for efficient bit counting
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const h1 = hexToBigInt(hash1);
  const h2 = hexToBigInt(hash2);

  let xor = h1 ^ h2;
  let distance = 0;

  // count set bits
  while (xor > 0n) {
    xor &= xor - 1n;
    distance++;
  }

  return distance;
}

export function distanceToSimilarity(distance: number, hashBits: number = 64): number {
  return 1 - distance / hashBits;
}

export function similarityToDistance(similarity: number, hashBits: number = 64): number {
  return Math.round((1 - similarity) * hashBits);
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Generate a hash from an array of values by comparing each to the median
 */
export function valuesToHash(values: number[]): string {
  const median = computeMedian(values);
  let hash = 0n;

  for (let i = 0; i < Math.min(values.length, 64); i++) {
    if (values[i] > median) {
      hash |= 1n << BigInt(i);
    }
  }

  return bigIntToHex(hash, 16);
}
