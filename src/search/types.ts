import type { HashAlgorithm, HashWeights } from '../types/config';
import type { MediaEntry } from '../types/media';

export interface SearchCandidate {
  /** Media ID */
  mediaId: string;
  /** Distances for each hash algorithm */
  distances: Partial<Record<HashAlgorithm, number>>;
  /** Media entry (loaded after search) */
  entry?: MediaEntry;
}

export interface ScoredCandidate extends SearchCandidate {
  /** Primary distance (from the main hash algorithm) */
  primaryDistance: number;
  /** Weighted score (0-1, higher = more similar) */
  weightedScore: number;
  /** Primary similarity (0-1) */
  similarity: number;
}

export interface SearchOptions {
  /** Hash algorithm to use for primary search */
  hashAlgorithm: HashAlgorithm;
  /** Maximum Hamming distance threshold */
  threshold: number;
  /** Optional weights for multi-hash scoring */
  weights?: HashWeights;
  /** Maximum results to return */
  limit: number;
}
