import type { MediaSource } from '../types';

export interface HashResult {
  /** The computed hash as a hex string */
  hash: string;
  /** Processing time in milliseconds */
  processingTime: number;
}

export interface ImageHasher {
  compute(source: MediaSource): Promise<HashResult>;
  /** Hash algorithm name */
  readonly name: string;
}

export interface ImageData {
  /** Raw pixel data (grayscale or RGB) */
  data: Uint8Array;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Number of channels (1 for grayscale, 3 for RGB) */
  channels: number;
}
