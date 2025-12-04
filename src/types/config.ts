export type HashAlgorithm = 'phash' | 'dhash' | 'ahash' | 'colorHash';

export type HashSize = 64 | 256;

/**
 * How to handle images with different aspect ratios before hashing:
 * - `stretch`: Stretch/compress to fit target size (fast, but aspect ratio sensitive)
 * - `crop`: Center crop to square before resizing (good for centered content)
 * - `pad`: Fit within target maintaining aspect ratio, pad with average color (preserves all content)
 */
export type AspectRatioMode = 'stretch' | 'crop' | 'pad';

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
  /** Hash size in bits: 64 (default) or 256 for higher accuracy */
  hashSize?: HashSize;
  /** How to handle different aspect ratios: 'stretch' (default), 'crop', or 'pad' */
  aspectRatioMode?: AspectRatioMode;
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
