import type { HashAlgorithm } from './config';
import type { ComputedHashes } from './media';

export interface AddResult {
  mediaId: string;
  hashes: ComputedHashes;
  /** processing time */
  processingTime: number;
}

export interface SearchResult {
  mediaId: string;
  /** Hamming distance (lower = more similar) */
  distance: number;
  /** Similarity score (0-1, higher = more similar) */
  similarity: number;
  /** Hash algorithm that produced the match */
  matchedHash: HashAlgorithm;
  /** Weighted score when using multiple hashes */
  weightedScore?: number;
  metadata: Record<string, unknown>;
  hashes: ComputedHashes;
}

export interface BatchOptions {
  /** (default: 5) */
  concurrency?: number;
  continueOnError?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

export interface BatchResult {
  successful: AddResult[];
  failed: Array<{
    input: unknown;
    error: Error;
  }>;
  /** Processing time */
  totalTime: number;
}

export interface IndexStats {
  totalMedia: number;
  imageCount: number;
  videoCount: number;
  /** Hash counts by algorithm */
  hashCounts: Record<HashAlgorithm, number>;
  /** Index storage size in bytes (approximate) */
  storageSizeBytes: number;
}
