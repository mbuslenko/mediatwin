import type { Readable } from 'stream';
import type { HashAlgorithm, HashWeights } from './config';

export type MediaType = 'image' | 'video';

export type MediaSource = string | Buffer | Readable;

export interface MediaInput {
  /** (auto-generated if not provided) */
  id?: string;
  /** File path, Buffer, or Readable stream */
  source: MediaSource;
  /** (auto-detected if not provided) */
  type?: MediaType;
  metadata?: Record<string, unknown>;
}

export interface SearchInput {
  /** File path, Buffer, or Readable stream to search for */
  source: MediaSource;
  /** Maximum Hamming distance threshold (0-64) */
  threshold: number;
  hashAlgorithm?: HashAlgorithm;
  weights?: HashWeights;
  /** (default: 100) */
  limit?: number;
}

export interface FrameHash {
  timestamp: number;
  hashes: ComputedHashes;
}

export interface VideoHashes {
  frames?: FrameHash[];
  vhash?: string;
}

export interface ComputedHashes {
  phash?: string;
  dhash?: string;
  ahash?: string;
  colorHash?: string;
  videoHashes?: VideoHashes;
}

export interface MediaEntry {
  id: string;
  type: MediaType;
  hashes: ComputedHashes;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
