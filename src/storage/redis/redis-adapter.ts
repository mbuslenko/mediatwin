import Redis from 'ioredis';
import type { HashAlgorithm } from '../../types/config';
import type { MediaEntry } from '../../types/media';
import { StorageAdapter, type BKTreeData, type StorageStats } from '../types';
import {
  serializeMediaEntry,
  deserializeMediaEntry,
  mediaKey,
  bkTreeKey,
  mediaKeyPattern,
} from './serialization';

export interface RedisAdapterOptions {
  namespace?: string;
  connectTimeout?: number;
  commandTimeout?: number;
}

export class RedisStorageAdapter extends StorageAdapter {
  private client: Redis | null = null;
  private readonly connectionString: string;
  private readonly namespace: string;
  private readonly options: RedisAdapterOptions;

  constructor(connectionString: string, options: RedisAdapterOptions = {}) {
    super();
    this.connectionString = connectionString;
    this.namespace = options.namespace || 'default';
    this.options = options;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    this.client = new Redis(this.connectionString, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      connectTimeout: this.options.connectTimeout || 10000,
      commandTimeout: this.options.commandTimeout || 5000,
    });

    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }

  private ensureConnected(): Redis {
    if (!this.client || !this.connected) {
      throw new Error('Redis adapter is not connected');
    }
    return this.client;
  }

  async saveMedia(entry: MediaEntry): Promise<void> {
    const client = this.ensureConnected();
    const key = mediaKey(this.namespace, entry.id);
    const data = serializeMediaEntry(entry);

    await client.hset(key, data);
  }

  async getMedia(mediaId: string): Promise<MediaEntry | null> {
    const client = this.ensureConnected();
    const key = mediaKey(this.namespace, mediaId);
    const data = await client.hgetall(key);

    return deserializeMediaEntry(data);
  }

  async deleteMedia(mediaId: string): Promise<boolean> {
    const client = this.ensureConnected();
    const key = mediaKey(this.namespace, mediaId);
    const deleted = await client.del(key);

    return deleted > 0;
  }

  async mediaExists(mediaId: string): Promise<boolean> {
    const client = this.ensureConnected();
    const key = mediaKey(this.namespace, mediaId);
    const exists = await client.exists(key);

    return exists > 0;
  }

  async loadBKTreeData(hashType: HashAlgorithm): Promise<BKTreeData | null> {
    const client = this.ensureConnected();
    const key = bkTreeKey(this.namespace, hashType);
    const data = await client.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as BKTreeData;
  }

  async saveBKTreeData(hashType: HashAlgorithm, data: BKTreeData): Promise<void> {
    const client = this.ensureConnected();
    const key = bkTreeKey(this.namespace, hashType);

    await client.set(key, JSON.stringify(data));
  }

  async *getAllMediaEntries(): AsyncIterable<MediaEntry> {
    const client = this.ensureConnected();
    const pattern = mediaKeyPattern(this.namespace);
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        const data = await client.hgetall(key);
        const entry = deserializeMediaEntry(data);
        if (entry) {
          yield entry;
        }
      }
    } while (cursor !== '0');
  }

  async getMediaBatch(mediaIds: string[]): Promise<MediaEntry[]> {
    const client = this.ensureConnected();
    const results: MediaEntry[] = [];

    // Use pipeline for efficient batch fetching
    const pipeline = client.pipeline();

    for (const id of mediaIds) {
      const key = mediaKey(this.namespace, id);
      pipeline.hgetall(key);
    }

    const responses = await pipeline.exec();

    if (responses) {
      for (const [err, data] of responses) {
        if (!err && data) {
          const entry = deserializeMediaEntry(data as Record<string, string>);
          if (entry) {
            results.push(entry);
          }
        }
      }
    }

    return results;
  }

  async countMedia(): Promise<number> {
    const client = this.ensureConnected();
    const pattern = mediaKeyPattern(this.namespace);
    let count = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');

    return count;
  }

  async getStats(): Promise<StorageStats> {
    const client = this.ensureConnected();
    let imageCount = 0;
    let videoCount = 0;
    const hashCounts: Partial<Record<HashAlgorithm, number>> = {};
    let storageSizeBytes = 0;

    for await (const entry of this.getAllMediaEntries()) {
      if (entry.type === 'image') {
        imageCount++;
      } else {
        videoCount++;
      }

      for (const algo of ['phash', 'dhash', 'ahash', 'colorHash'] as HashAlgorithm[]) {
        if (entry.hashes[algo]) {
          hashCounts[algo] = (hashCounts[algo] || 0) + 1;
        }
      }

      // rough estimate
      storageSizeBytes += JSON.stringify(entry).length;
    }

    // add BK-tree data sizes
    for (const algo of ['phash', 'dhash', 'ahash', 'colorHash'] as HashAlgorithm[]) {
      const key = bkTreeKey(this.namespace, algo);
      const data = await client.get(key);
      if (data) {
        storageSizeBytes += data.length;
      }
    }

    return {
      totalMedia: imageCount + videoCount,
      imageCount,
      videoCount,
      hashCounts,
      storageSizeBytes,
    };
  }

  /**
   * Get the underlying Redis client
   */
  getClient(): Redis | null {
    return this.client;
  }

  getNamespace(): string {
    return this.namespace;
  }
}
