import type { HashAlgorithm, HashWeights } from '../types/config';
import type { ComputedHashes } from '../types/media';
import type { SearchResult } from '../types/results';
import { hammingDistance, distanceToSimilarity } from '../utils/hash-utils';
import { BKTree } from '../storage/redis/bktree';
import type { StorageAdapter } from '../storage/types';
import type { SearchOptions, ScoredCandidate } from './types';

/**
 * Engine for similarity search across multiple hash algorithms
 */
export class SimilarityEngine {
  private bkTrees: Map<HashAlgorithm, BKTree> = new Map();
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Initialize BK-trees from storage
   */
  async initialize(algorithms: HashAlgorithm[]): Promise<void> {
    for (const algo of algorithms) {
      const data = await this.storage.loadBKTreeData(algo);

      if (data) {
        this.bkTrees.set(algo, BKTree.deserialize(data));
      } else {
        this.bkTrees.set(algo, new BKTree());
      }
    }
  }

  /**
   * Rebuild BK-trees from all media entries
   */
  async rebuildTrees(algorithms: HashAlgorithm[]): Promise<void> {
    // Clear existing trees
    for (const algo of algorithms) {
      this.bkTrees.set(algo, new BKTree());
    }

    // Iterate over all media and insert into trees
    for await (const entry of this.storage.getAllMediaEntries()) {
      this.addToTrees(entry.id, entry.hashes, algorithms);
    }

    // Persist trees
    await this.persistTrees(algorithms);
  }

  /**
   * Add hashes to BK-trees
   */
  addToTrees(mediaId: string, hashes: ComputedHashes, algorithms: HashAlgorithm[]): void {
    for (const algo of algorithms) {
      const hash = hashes[algo];
      const tree = this.bkTrees.get(algo);

      if (hash && tree) {
        tree.insert(hash, mediaId);
      }
    }
  }

  /**
   * Remove from BK-trees
   */
  removeFromTrees(mediaId: string, algorithms: HashAlgorithm[]): void {
    for (const algo of algorithms) {
      const tree = this.bkTrees.get(algo);
      if (tree) {
        tree.remove(mediaId);
      }
    }
  }

  /**
   * Persist BK-trees to storage
   */
  async persistTrees(algorithms: HashAlgorithm[]): Promise<void> {
    for (const algo of algorithms) {
      const tree = this.bkTrees.get(algo);
      if (tree) {
        const data = tree.serialize();
        await this.storage.saveBKTreeData(algo, data);
      }
    }
  }

  /**
   * Search for similar media
   */
  async search(
    queryHashes: ComputedHashes,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { hashAlgorithm, threshold, weights, limit } = options;

    // Get primary hash
    const primaryHash = queryHashes[hashAlgorithm];
    if (!primaryHash) {
      throw new Error(`Query hash for algorithm ${hashAlgorithm} is not available`);
    }

    // Get BK-tree for primary algorithm
    const tree = this.bkTrees.get(hashAlgorithm);
    if (!tree || tree.isEmpty()) {
      return [];
    }

    // Search BK-tree
    const candidates = tree.search(primaryHash, threshold);

    if (candidates.length === 0) {
      return [];
    }

    // Get media IDs
    const mediaIds = candidates.map((c) => c.mediaId);

    // Load media entries
    const entries = await this.storage.getMediaBatch(mediaIds);
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    // Build scored results
    const scoredResults: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      const entry = entryMap.get(candidate.mediaId);
      if (!entry) continue;

      // Calculate distances for all hash algorithms
      const distances: Partial<Record<HashAlgorithm, number>> = {
        [hashAlgorithm]: candidate.distance,
      };

      // Calculate distances for other algorithms if weights are provided
      if (weights) {
        for (const algo of Object.keys(weights) as HashAlgorithm[]) {
          if (algo !== hashAlgorithm && queryHashes[algo] && entry.hashes[algo]) {
            distances[algo] = hammingDistance(queryHashes[algo]!, entry.hashes[algo]!);
          }
        }
      }

      // Calculate weighted score
      const weightedScore = this.calculateWeightedScore(distances, weights);

      scoredResults.push({
        mediaId: candidate.mediaId,
        distances,
        entry,
        primaryDistance: candidate.distance,
        weightedScore,
        similarity: distanceToSimilarity(candidate.distance),
      });
    }

    // Sort by weighted score (descending) or distance (ascending)
    if (weights) {
      scoredResults.sort((a, b) => b.weightedScore - a.weightedScore);
    } else {
      scoredResults.sort((a, b) => a.primaryDistance - b.primaryDistance);
    }

    // Limit results and convert to SearchResult format
    return scoredResults.slice(0, limit).map((scored) => ({
      mediaId: scored.mediaId,
      distance: scored.primaryDistance,
      similarity: scored.similarity,
      matchedHash: hashAlgorithm,
      weightedScore: scored.weightedScore,
      metadata: scored.entry?.metadata || {},
      hashes: scored.entry?.hashes || {},
    }));
  }

  /**
   * Calculate weighted similarity score
   */
  private calculateWeightedScore(
    distances: Partial<Record<HashAlgorithm, number>>,
    weights?: HashWeights
  ): number {
    if (!weights) {
      // Use first available distance
      const firstDistance = Object.values(distances)[0];
      return firstDistance !== undefined ? distanceToSimilarity(firstDistance) : 0;
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const [algo, weight] of Object.entries(weights) as [HashAlgorithm, number][]) {
      const distance = distances[algo];
      if (weight && distance !== undefined) {
        const similarity = distanceToSimilarity(distance);
        totalScore += similarity * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Get tree statistics
   */
  getTreeStats(): Record<HashAlgorithm, { size: number; depth: number; avgBranching: number }> {
    const stats: Record<string, { size: number; depth: number; avgBranching: number }> = {};

    for (const [algo, tree] of this.bkTrees) {
      const treeStats = tree.getStats();
      stats[algo] = {
        size: tree.size(),
        depth: treeStats.depth,
        avgBranching: treeStats.avgBranchingFactor,
      };
    }

    return stats as Record<HashAlgorithm, { size: number; depth: number; avgBranching: number }>;
  }
}
