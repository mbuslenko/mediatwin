import { describe, it, expect } from 'vitest';
import {
  hammingDistance,
  distanceToSimilarity,
  similarityToDistance,
  computeMedian,
  hexToBigInt,
  bigIntToHex,
} from '../../src/utils/hash-utils';

describe('hash-utils', () => {
  describe('hammingDistance', () => {
    it('returns 0 for identical hashes', () => {
      const hash = 'a1b2c3d4e5f60789';
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('returns correct distance for different hashes', () => {
      // These hashes differ by 1 bit
      const hash1 = '0000000000000000';
      const hash2 = '0000000000000001';
      expect(hammingDistance(hash1, hash2)).toBe(1);
    });

    it('returns 64 for completely opposite hashes', () => {
      const hash1 = '0000000000000000';
      const hash2 = 'ffffffffffffffff';
      expect(hammingDistance(hash1, hash2)).toBe(64);
    });

    it('handles various bit differences', () => {
      const hash1 = '000000000000000f';
      const hash2 = '0000000000000000';
      expect(hammingDistance(hash1, hash2)).toBe(4);
    });
  });

  describe('distanceToSimilarity', () => {
    it('returns 1 for distance 0', () => {
      expect(distanceToSimilarity(0)).toBe(1);
    });

    it('returns 0 for distance 64', () => {
      expect(distanceToSimilarity(64)).toBe(0);
    });

    it('returns 0.5 for distance 32', () => {
      expect(distanceToSimilarity(32)).toBe(0.5);
    });
  });

  describe('similarityToDistance', () => {
    it('returns 0 for similarity 1', () => {
      expect(similarityToDistance(1)).toBe(0);
    });

    it('returns 64 for similarity 0', () => {
      expect(similarityToDistance(0)).toBe(64);
    });

    it('returns 32 for similarity 0.5', () => {
      expect(similarityToDistance(0.5)).toBe(32);
    });
  });

  describe('computeMedian', () => {
    it('returns 0 for empty array', () => {
      expect(computeMedian([])).toBe(0);
    });

    it('returns the middle value for odd-length arrays', () => {
      expect(computeMedian([1, 2, 3])).toBe(2);
      expect(computeMedian([1, 5, 3, 4, 2])).toBe(3);
    });

    it('returns average of middle values for even-length arrays', () => {
      expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
      expect(computeMedian([1, 2])).toBe(1.5);
    });
  });

  describe('hexToBigInt and bigIntToHex', () => {
    it('converts hex to bigint correctly', () => {
      expect(hexToBigInt('ff')).toBe(255n);
      expect(hexToBigInt('0000000000000001')).toBe(1n);
    });

    it('converts bigint to hex correctly', () => {
      expect(bigIntToHex(255n, 2)).toBe('ff');
      expect(bigIntToHex(1n, 16)).toBe('0000000000000001');
    });

    it('round-trips correctly', () => {
      const original = 'a1b2c3d4e5f60789';
      expect(bigIntToHex(hexToBigInt(original), 16)).toBe(original);
    });
  });
});
