# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-12-04

### Added

- **Aspect Ratio Mode** - New `aspectRatioMode` config option to handle images with different aspect ratios
  - `stretch` - Stretch to fit (default, fast)
  - `crop` - Center crop to square before resizing
  - `pad` - Fit within bounds, pad with dominant color (recommended for mixed aspect ratios)

### Fixed

- Exported `HashSize` and `AspectRatioMode` types from main entry point

---

## [0.1.0] - 2025-11-27

### Added

#### Core Features
- **MediaTwin class** - Main entry point for media similarity detection
  - `add()` - Index single media (image or video)
  - `addBatch()` - Batch indexing with concurrency control
  - `search()` - Find similar media with configurable thresholds
  - `remove()` - Remove media from index
  - `get()` / `exists()` - Retrieve or check media entries
  - `getStats()` - Get index statistics
  - `rebuildIndex()` - Rebuild search index from storage

#### Image Hashing Algorithms
- **pHash (Perceptual Hash)** - DCT-based hash, best for general similarity
- **dHash (Difference Hash)** - Gradient-based hash, good for detecting edits
- **aHash (Average Hash)** - Fast and simple, good for exact duplicates
- **colorHash (Color Histogram Hash)** - Color distribution hash, good for color-based matching

#### Video Processing
- **Frame sampling** - Extract frames at configurable intervals
- **vHash (Video Hash)** - Temporal hash combining frame data
- FFmpeg-based frame extraction with temp file handling

#### Hash Sizes
- **64-bit hashes** - Standard size, faster processing
- **256-bit hashes** - Higher accuracy for large-scale deduplication

#### Search Features
- **BK-tree indexing** - Efficient Hamming distance search in O(log n)
- **Multi-algorithm weighted search** - Combine multiple hash algorithms with custom weights
- **Threshold-based filtering** - Set maximum Hamming distance for matches
- **Similarity scoring** - Normalized 0-1 similarity scores

#### Storage
- **Redis adapter** - Persistent storage with ioredis
- **Namespace support** - Multiple isolated indexes in same Redis instance
- **BK-tree serialization** - Persist and restore search trees

#### Utilities
- `hammingDistance()` - Calculate Hamming distance between hashes
- `distanceToSimilarity()` - Convert distance to 0-1 similarity
- `similarityToDistance()` - Convert similarity to distance
- Standalone hash functions (`computePHash`, `computeDHash`, etc.)

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.1 | 2024-12-04 | Added aspectRatioMode for handling mixed aspect ratios |
| 0.1.0 | 2024-12-04 | Initial release |
