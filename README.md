# mediatwin

Find similar images and videos in your collection. Fast.

Built for cases where you need to compare against hundreds of thousands of files without waiting forever. Uses perceptual hashing and BK-trees to make similarity search actually practical at scale.

## Install

```bash
npm install mediatwin
```

This is an ESM-only package. Your project needs `"type": "module"` in package.json (or use `.mjs` files).

You'll also need Redis running somewhere. The package handles everything else.

## Quick Start

```typescript
import { MediaTwin } from 'mediatwin';

const mt = new MediaTwin({
  redis: 'redis://localhost:6379'
});

await mt.connect();

// Index some images
await mt.add({ source: './photo1.jpg' });
await mt.add({ source: './photo2.png' });
await mt.add({ source: './video.mp4' });

// Find similar ones
const matches = await mt.search({
  source: './query.jpg',
  threshold: 10
});

console.log(matches);
// [{ mediaId: 'abc123', distance: 3, similarity: 0.95, ... }]

await mt.disconnect();
```

## How It Works

The package computes perceptual hashes for your media files. Unlike cryptographic hashes (MD5, SHA), perceptual hashes are designed so that visually similar images produce similar hash values.

When you search, it doesn't compare your query against every single file. Instead, it uses a BK-tree data structure that exploits the triangle inequality of Hamming distance. This means search time grows much slower than your dataset size.

**What's the threshold?** It's the maximum Hamming distance (number of different bits) between two hashes. Lower = stricter matching.

For **64-bit hashes** (default)
For **256-bit hashes** (`hashSize: 256`), multiply thresholds by ~4

256-bit hashes capture more detail and reduce false positives, but require more time and RAM.

## Configuration

```typescript
const mt = new MediaTwin({
  // Required
  redis: 'redis://localhost:6379',

  // Optional
  namespace: 'myapp',                 // Key prefix in Redis (default: 'default')
  hashAlgorithms: ['phash', 'dhash'], // Which hashes to compute (default: ['phash'])
  hashSize: 256,                      // Hash size: 64 (default) or 256 for higher accuracy

  videoOptions: {
    frameInterval: 2,                 // Extract frame every N seconds (default: 1)
    maxFrames: 30,                    // Cap on frames to extract (default: 60)
    enableVHash: true                 // Compute video-specific hash (default: false)
  }
});
```

### Hash Algorithms

You can use one or combine several:

| Algorithm | Speed | Best For |
|-----------|-------|----------|
| `phash` | Medium | General purpose, handles most transformations well |
| `dhash` | Fast | Good all-rounder, slightly faster than phash |
| `ahash` | Fastest | Quick duplicate detection, less robust to edits |
| `colorHash` | Medium | Color-based similarity (ignores structure) |

Using multiple algorithms and weighted scoring gives better accuracy at the cost of more storage and slightly slower indexing.

### Configurations

Each project requires individual configuration, so take special care when selecting the necessary parameters. For greater accuracy, we recommend an approach with multiple algorithms and weighting each one according to your needs:
```typescript
const result = await mt.search({
    source: './image.jpg',
    threshold: 130,  // Higher threshold for 256-bit
    weights: {
      phash: 0.4,
      dhash: 0.3,
      ahash: 0.15,
      colorHash: 0.15,
    },
  });
```

When using multi-algo approach, you should look on weightedScore field instead of similarity or distance in the response.

### Edge cases

When searching for similar media files, there are many different cases where two images are as similar as possible, but the algorithms still indicate that they are different. Such cases will be covered one after another. As of today, the following issues have been resolved:

1. **Different image proportions**, use aspectRatioMode to handle different aspect ratios of media files. 
 - 'stretch' (default): Fast, but sensitive to aspect ratio differences
 - 'crop': Center crops to square - good if subject is always centered
 - 'pad': Maintains aspect ratio with padding - recommended for mixed
 aspect ratios
 
 ```typescript
 const mt = new MediaTwin({
    redis: 'redis://127.0.0.1:6379',
    hashAlgorithms: ['phash', 'dhash', 'ahash', 'colorHash'],
    hashSize: 256,  // Use 256-bit hashes for higher accuracy
    aspectRatioMode: 'pad',
  });
 ```

## API

### Adding Media

```typescript
// Basic
await mt.add({ source: './image.jpg' });

// With custom ID (otherwise auto-generated)
await mt.add({
  id: 'product-123',
  source: './image.jpg'
});

// With metadata (stored alongside, returned in search results)
await mt.add({
  source: './image.jpg',
  metadata: {
    originalName: 'vacation.jpg',
    uploadedBy: 'user-456',
    tags: ['beach', 'summer']
  }
});

// From buffer
const buffer = await fs.readFile('./image.jpg');
await mt.add({ source: buffer });

// Explicit type (auto-detected if not provided)
await mt.add({
  source: './file.dat',
  type: 'image'
});
```

The result tells you what was computed:

```typescript
const result = await mt.add({ source: './photo.jpg' });
// {
//   mediaId: 'V1StGXR8_Z5jdHi6B-myT',
//   hashes: { phash: 'a1b2c3d4e5f60789', dhash: '...' },
//   processingTime: 45.2
// }
```

### Searching

```typescript
// Basic search
const matches = await mt.search({
  source: './query.jpg',
  threshold: 10
});

// Limit results
const matches = await mt.search({
  source: './query.jpg',
  threshold: 15,
  limit: 5
});

// Use specific hash algorithm
const matches = await mt.search({
  source: './query.jpg',
  threshold: 10,
  hashAlgorithm: 'dhash'
});

// Weighted multi-hash search (when using multiple algorithms)
const matches = await mt.search({
  source: './query.jpg',
  threshold: 12,
  weights: {
    phash: 0.5,
    dhash: 0.3,
    colorHash: 0.2
  }
});
```

Results look like:

```typescript
[
  {
    mediaId: 'abc123',
    distance: 3,              // Hamming distance (lower = more similar)
    similarity: 0.953,        // 0-1 score (higher = more similar)
    matchedHash: 'phash',     // Which algorithm matched
    weightedScore: 0.92,      // Present when using weights
    metadata: { ... },        // Your custom metadata
    hashes: { ... }           // All computed hashes
  },
  // ...
]
```

### Other Operations

```typescript
// Get by ID
const entry = await mt.get('media-id');

// Check existence
const exists = await mt.exists('media-id');

// Remove
await mt.remove('media-id');

// Batch add (with concurrency control)
const results = await mt.addBatch(
  [
    { source: './img1.jpg' },
    { source: './img2.jpg' },
    { source: './img3.jpg' }
  ],
  {
    concurrency: 3,
    continueOnError: true,
    onProgress: (done, total) => console.log(`${done}/${total}`)
  }
);

// Stats
const stats = await mt.getStats();
// { totalMedia: 15000, imageCount: 14500, videoCount: 500, ... }

// Rebuild index (if you need to regenerate BK-trees)
await mt.rebuildIndex();
```

## Video Handling

Videos are processed by extracting frames at regular intervals and hashing each frame. When you search with a video, it finds videos that share similar frames.

```typescript
const mt = new MediaTwin({
  redis: 'redis://localhost:6379',
  hashAlgorithms: ['phash'],
  videoOptions: {
    frameInterval: 1,    // Every second
    maxFrames: 60,       // First 60 seconds max
    enableVHash: true    // Also compute a single hash for the whole video
  }
});
```

The `vHash` option creates a single hash representing the entire video (by making a collage of frames and hashing that). Useful for quick video-to-video comparison.

**Note:** Video processing requires FFmpeg. The package bundles `ffmpeg-static` so you don't need to install it separately.

## Advanced Usage

### Custom Storage Backend

The storage layer is pluggable. Implement the `StorageAdapter` interface if you need something other than Redis:

```typescript
import { StorageAdapter } from 'mediatwin';

class MyStorageAdapter extends StorageAdapter {
  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async saveMedia(entry) { /* ... */ }
  async getMedia(id) { /* ... */ }
  // ... etc
}
```

## Common Issues

**"Unable to detect file type"**

The file might be corrupted or in an unsupported format. Supported formats:
- Images: jpg, png, gif, webp, bmp, tiff, avif, heic
- Videos: mp4, webm, mov, avi, mkv, flv, wmv

**"MediaTwin is not connected"**

You need to call `await mt.connect()` before using other methods.

**Search returns nothing even though similar images exist**

Try increasing the threshold. Start high (20-25) and work down to find your sweet spot.

**Video hashing is slow**

Reduce `maxFrames` or increase `frameInterval`. Processing 60 frames takes longer than 10.

**Redis connection errors**

Make sure Redis is running and accessible at the URL you provided. The package uses `ioredis` under the hood.

## License

MIT
