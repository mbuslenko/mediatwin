import type { HashAlgorithm } from '../types/config';
import type { MediaEntry } from '../types/media';

export interface BKTreeData {
  /** Serialized tree nodes */
  nodes: SerializedBKTreeNode[];
  /** Total number of entries */
  count: number;
  /** Last update timestamp */
  updatedAt: string;
}

export interface SerializedBKTreeNode {
  /** Hash value (hex string) */
  hash: string;
  /** Media ID */
  mediaId: string;
  /** Children: distance -> node index in the array */
  children: Record<number, number>;
}

export interface StorageStats {
  /** Total number of media entries */
  totalMedia: number;
  /** Number of images */
  imageCount: number;
  /** Number of videos */
  videoCount: number;
  /** Hash counts by algorithm */
  hashCounts: Partial<Record<HashAlgorithm, number>>;
  /** Approximate storage size in bytes */
  storageSizeBytes: number;
}

/**
 * Abstract storage adapter interface
 * Implementations must provide all CRUD and indexing operations
 */
export abstract class StorageAdapter {
  protected connected = false;

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to the storage backend
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the storage backend
   */
  abstract disconnect(): Promise<void>;

  // Media CRUD Operations

  /**
   * Save a media entry
   */
  abstract saveMedia(entry: MediaEntry): Promise<void>;

  /**
   * Get a media entry by ID
   */
  abstract getMedia(mediaId: string): Promise<MediaEntry | null>;

  /**
   * Delete a media entry
   */
  abstract deleteMedia(mediaId: string): Promise<boolean>;

  /**
   * Check if a media entry exists
   */
  abstract mediaExists(mediaId: string): Promise<boolean>;

  // BK-Tree Persistence

  /**
   * Load BK-tree data for a specific hash algorithm
   */
  abstract loadBKTreeData(hashType: HashAlgorithm): Promise<BKTreeData | null>;

  /**
   * Save BK-tree data for a specific hash algorithm
   */
  abstract saveBKTreeData(hashType: HashAlgorithm, data: BKTreeData): Promise<void>;

  // Bulk Operations

  /**
   * Iterate over all media entries
   */
  abstract getAllMediaEntries(): AsyncIterable<MediaEntry>;

  /**
   * Get multiple media entries by IDs
   */
  abstract getMediaBatch(mediaIds: string[]): Promise<MediaEntry[]>;

  /**
   * Count total media entries
   */
  abstract countMedia(): Promise<number>;

  // Stats

  /**
   * Get storage statistics
   */
  abstract getStats(): Promise<StorageStats>;
}
