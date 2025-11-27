export { MediaTwin } from './mediatwin';

export type {
  MediaTwinConfig,
  HashAlgorithm,
  VideoOptions,
  HashWeights,
} from './types/config';
export { DEFAULT_HASH_WEIGHTS, DEFAULT_VIDEO_OPTIONS } from './types/config';

export type {
  MediaType,
  MediaSource,
  MediaInput,
  SearchInput,
  FrameHash,
  VideoHashes,
  ComputedHashes,
  MediaEntry,
} from './types/media';

export type {
  AddResult,
  SearchResult,
  BatchOptions,
  BatchResult,
  IndexStats,
} from './types/results';

export {
  hammingDistance,
  distanceToSimilarity,
  similarityToDistance,
} from './utils/hash-utils';

export { StorageAdapter, type BKTreeData, type StorageStats } from './storage/types';
export { RedisStorageAdapter } from './storage/redis/redis-adapter';
export { BKTree, type BKTreeSearchResult } from './storage/redis/bktree';

export { PHasher, computePHash } from './hashing/image/phash';
export { DHasher, computeDHash } from './hashing/image/dhash';
export { AHasher, computeAHash } from './hashing/image/ahash';
export { ColorHasher, computeColorHash } from './hashing/image/color-hash';
export { VHasher, computeVHash } from './hashing/video/vhash';
export { FrameSampler } from './hashing/video/frame-sampler';

export { SimilarityEngine } from './search/similarity-engine';
