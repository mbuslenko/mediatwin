export type HashAlgorithm = 'phash' | 'dhash' | 'ahash' | 'colorHash';

export interface VideoOptions {
  /** Seconds between frame extractions (default: 1) */
  frameInterval?: number;
  /** Maximum number of frames to extract (default: 60) */
  maxFrames?: number;
  enableVHash?: boolean;
}

export interface MediaTwinConfig {
  redis: string;
  /** Redis key namespace prefix */
  namespace?: string;
  hashAlgorithms?: HashAlgorithm[];
  videoOptions?: VideoOptions;
}

export interface HashWeights {
  /** Weight for perceptual hash (0-1) */
  phash?: number;
  /** Weight for difference hash (0-1) */
  dhash?: number;
  /** Weight for average hash (0-1) */
  ahash?: number;
  /** Weight for color hash (0-1) */
  colorHash?: number;
}

export const DEFAULT_HASH_WEIGHTS: HashWeights = {
  phash: 0.4,
  dhash: 0.3,
  ahash: 0.15,
  colorHash: 0.15,
};

export const DEFAULT_VIDEO_OPTIONS: Required<VideoOptions> = {
  frameInterval: 1,
  maxFrames: 60,
  enableVHash: false,
};
