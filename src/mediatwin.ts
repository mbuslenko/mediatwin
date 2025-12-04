import { nanoid } from 'nanoid';
import type {
  MediaTwinConfig,
  HashAlgorithm,
  HashSize,
  AspectRatioMode,
  VideoOptions,
} from './types/config';
import type { MediaInput, SearchInput, MediaEntry, ComputedHashes } from './types/media';
import type { AddResult, SearchResult, BatchOptions, BatchResult, IndexStats } from './types/results';
import { validateMediaInput, validateSearchInput, validateRedisConnection } from './utils/validation';
import { detectMediaType, sourceToBuffer } from './utils/file-utils';
import { PHasher, DHasher, AHasher, ColorHasher } from './hashing/image';
import { FrameSampler, VHasher } from './hashing/video';
import { RedisStorageAdapter } from './storage/redis/redis-adapter';
import type { StorageAdapter } from './storage/types';
import { SimilarityEngine } from './search/similarity-engine';

/**
 * MediaTwin - Media similarity detection
 *
 * Example usage:
 * ```typescript
 * const mt = new MediaTwin({
 *   redis: 'redis://localhost:6379',
 *   hashAlgorithms: ['phash', 'dhash'],
 * });
 *
 * await mt.connect();
 *
 * // Add media
 * await mt.add({ source: './image.jpg' });
 *
 * // Search for similar
 * const results = await mt.search({
 *   source: './query.jpg',
 *   threshold: 10,
 * });
 * ```
 */
export class MediaTwin {
  private config: Required<MediaTwinConfig> & { videoOptions: Required<VideoOptions>; hashSize: HashSize; aspectRatioMode: AspectRatioMode };
  private storage: StorageAdapter;
  private searchEngine: SimilarityEngine;
  private connected = false;

  private imageHashers: Map<HashAlgorithm, { compute: (source: Buffer) => Promise<{ hash: string }> }>;
  private frameSampler: FrameSampler | null = null;
  private vHasher: VHasher | null = null;

  public redis!: import('ioredis').default;

  constructor(config: MediaTwinConfig) {
    validateRedisConnection(config.redis);

    this.config = {
      redis: config.redis,
      namespace: config.namespace || 'default',
      hashAlgorithms: config.hashAlgorithms || ['phash'],
      hashSize: config.hashSize || 64,
      aspectRatioMode: config.aspectRatioMode || 'stretch',
      videoOptions: {
        frameInterval: config.videoOptions?.frameInterval ?? 1,
        maxFrames: config.videoOptions?.maxFrames ?? 60,
        enableVHash: config.videoOptions?.enableVHash ?? false,
      },
    };

    this.storage = new RedisStorageAdapter(this.config.redis, {
      namespace: this.config.namespace,
    });

    this.searchEngine = new SimilarityEngine(this.storage, this.config.hashSize);

    const hashSize = this.config.hashSize;
    const aspectRatioMode = this.config.aspectRatioMode;

    this.imageHashers = new Map();
    if (this.config.hashAlgorithms.includes('phash')) {
      this.imageHashers.set('phash', new PHasher(hashSize, aspectRatioMode));
    }
    if (this.config.hashAlgorithms.includes('dhash')) {
      this.imageHashers.set('dhash', new DHasher(hashSize, aspectRatioMode));
    }
    if (this.config.hashAlgorithms.includes('ahash')) {
      this.imageHashers.set('ahash', new AHasher(hashSize, aspectRatioMode));
    }
    if (this.config.hashAlgorithms.includes('colorHash')) {
      this.imageHashers.set('colorHash', new ColorHasher(hashSize, aspectRatioMode));
    }

    this.frameSampler = new FrameSampler({
      interval: this.config.videoOptions.frameInterval,
      maxFrames: this.config.videoOptions.maxFrames,
      hashAlgorithms: this.config.hashAlgorithms,
      hashSize: this.config.hashSize,
      aspectRatioMode: this.config.aspectRatioMode,
    });

    if (this.config.videoOptions.enableVHash) {
      this.vHasher = new VHasher(
        this.config.videoOptions.frameInterval,
        this.config.videoOptions.maxFrames
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await this.storage.connect();
    await this.searchEngine.initialize(this.config.hashAlgorithms);
    this.redis = (this.storage as RedisStorageAdapter).getClient()!;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.searchEngine.persistTrees(this.config.hashAlgorithms);
    await this.storage.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Add media to the index
   */
  async add(input: MediaInput): Promise<AddResult> {
    this.ensureConnected();
    validateMediaInput(input);

    const startTime = performance.now();

    const mediaId = input.id || nanoid();
    const mediaType = input.type || (await detectMediaType(input.source));

    let hashes: ComputedHashes;

    if (mediaType === 'image') {
      hashes = await this.computeImageHashes(input.source);
    } else {
      hashes = await this.computeVideoHashes(input.source as string);
    }

    const entry: MediaEntry = {
      id: mediaId,
      type: mediaType,
      hashes,
      metadata: input.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.saveMedia(entry);

    this.searchEngine.addToTrees(mediaId, hashes, this.config.hashAlgorithms);

    // TODO: This should be debounced
    await this.searchEngine.persistTrees(this.config.hashAlgorithms);

    const processingTime = performance.now() - startTime;

    return {
      mediaId,
      hashes,
      processingTime,
    };
  }

  /**
   * Search for similar media
   */
  async search(input: SearchInput): Promise<SearchResult[]> {
    this.ensureConnected();
    validateSearchInput(input);

    const mediaType = await detectMediaType(input.source);

    let queryHashes: ComputedHashes;

    if (mediaType === 'image') {
      queryHashes = await this.computeImageHashes(input.source);
    } else {
      queryHashes = await this.computeVideoHashes(input.source as string);
    }

    const hashAlgorithm = input.hashAlgorithm || this.config.hashAlgorithms[0];

    return this.searchEngine.search(queryHashes, {
      hashAlgorithm,
      threshold: input.threshold,
      weights: input.weights,
      limit: input.limit || 100,
    });
  }

  /**
   * Remove media from the index
   */
  async remove(mediaId: string): Promise<boolean> {
    this.ensureConnected();

    this.searchEngine.removeFromTrees(mediaId, this.config.hashAlgorithms);

    const deleted = await this.storage.deleteMedia(mediaId);

    if (deleted) {
      await this.searchEngine.persistTrees(this.config.hashAlgorithms);
    }

    return deleted;
  }

  /**
   * Get media entry by ID
   */
  async get(mediaId: string): Promise<MediaEntry | null> {
    this.ensureConnected();
    return this.storage.getMedia(mediaId);
  }

  async exists(mediaId: string): Promise<boolean> {
    this.ensureConnected();
    return this.storage.mediaExists(mediaId);
  }

  /**
   * Add multiple media items in batch
   */
  async addBatch(inputs: MediaInput[], options: BatchOptions = {}): Promise<BatchResult> {
    this.ensureConnected();

    const startTime = performance.now();
    const concurrency = options.concurrency || 5;
    const continueOnError = options.continueOnError || false;

    const successful: AddResult[] = [];
    const failed: Array<{ input: unknown; error: Error }> = [];

    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency);

      const results = await Promise.allSettled(batch.map((input) => this.add(input)));

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const input = batch[j];

        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          if (!continueOnError) {
            throw result.reason;
          }
          failed.push({ input, error: result.reason });
        }
      }

      if (options.onProgress) {
        options.onProgress(i + batch.length, inputs.length);
      }
    }

    const totalTime = performance.now() - startTime;

    return {
      successful,
      failed,
      totalTime,
    };
  }

  /**
   * Rebuild the search index from storage
   */
  async rebuildIndex(): Promise<void> {
    this.ensureConnected();
    await this.searchEngine.rebuildTrees(this.config.hashAlgorithms);
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    this.ensureConnected();

    const storageStats = await this.storage.getStats();

    return {
      totalMedia: storageStats.totalMedia,
      imageCount: storageStats.imageCount,
      videoCount: storageStats.videoCount,
      hashCounts: storageStats.hashCounts as Record<HashAlgorithm, number>,
      storageSizeBytes: storageStats.storageSizeBytes,
    };
  }

  /**
   * Compute hashes for an image
   */
  private async computeImageHashes(source: MediaInput['source']): Promise<ComputedHashes> {
    const buffer = await sourceToBuffer(source);
    const hashes: ComputedHashes = {};

    for (const [algo, hasher] of this.imageHashers) {
      try {
        const result = await hasher.compute(buffer);
        hashes[algo] = result.hash;
      } catch (err) {
        console.warn(`Failed to compute ${algo}: ${err}`);
      }
    }

    return hashes;
  }

  /**
   * Compute hashes for a video
   */
  private async computeVideoHashes(videoPath: string): Promise<ComputedHashes> {
    const hashes: ComputedHashes = {};

    if (this.frameSampler) {
      const frameHashes = await this.frameSampler.extractAndHash(videoPath);
      hashes.videoHashes = { frames: frameHashes };

      // use first frame's hashes as primary hashes for BK-tree indexing
      if (frameHashes.length > 0) {
        const firstFrame = frameHashes[0];
        for (const algo of this.config.hashAlgorithms) {
          if (firstFrame.hashes[algo]) {
            hashes[algo] = firstFrame.hashes[algo];
          }
        }
      }
    }

    if (this.vHasher) {
      try {
        const vhash = await this.vHasher.compute(videoPath);
        if (hashes.videoHashes) {
          hashes.videoHashes.vhash = vhash;
        } else {
          hashes.videoHashes = { vhash };
        }
      } catch (err) {
        console.warn(`Failed to compute vHash: ${err}`);
      }
    }

    return hashes;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('MediaTwin is not connected. Call connect() first.');
    }
  }
}
