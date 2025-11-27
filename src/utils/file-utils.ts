import { fileTypeFromBuffer } from 'file-type';
import { Readable } from 'stream';
import type { MediaSource, MediaType } from '../types';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'tiff',
  'tif',
  'avif',
  'heic',
  'heif',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
  'flv',
  'wmv',
  'm4v',
  'mpeg',
  'mpg',
  '3gp',
  'ogv',
]);

export async function detectMediaType(source: MediaSource): Promise<MediaType> {
  let result;

  if (typeof source === 'string') {
    const fs = await import('fs/promises');
    const handle = await fs.open(source, 'r');
    try {
      const buffer = Buffer.alloc(4100);
      await handle.read(buffer, 0, 4100, 0);
      result = await fileTypeFromBuffer(buffer);
    } finally {
      await handle.close();
    }
  } else if (Buffer.isBuffer(source)) {
    result = await fileTypeFromBuffer(source);
  } else if (isReadableStream(source)) {
    const buffer = await readFirstChunk(source, 4100);
    result = await fileTypeFromBuffer(buffer);
  } else {
    throw new Error('Invalid source type: expected file path, Buffer, or Readable stream');
  }

  if (!result) {
    throw new Error('Unable to detect file type');
  }

  if (IMAGE_EXTENSIONS.has(result.ext)) {
    return 'image';
  }

  if (VIDEO_EXTENSIONS.has(result.ext)) {
    return 'video';
  }

  throw new Error(`Unsupported media type: ${result.ext}`);
}

export function isReadableStream(value: unknown): value is Readable {
  return (
    value !== null &&
    typeof value === 'object' &&
    'pipe' in value &&
    typeof (value as Readable).pipe === 'function'
  );
}

async function readFirstChunk(stream: Readable, bytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      totalLength += chunk.length;

      if (totalLength >= bytes) {
        stream.removeListener('data', onData);
        stream.removeListener('error', onError);
        stream.removeListener('end', onEnd);
        resolve(Buffer.concat(chunks).slice(0, bytes));
      }
    };

    const onError = (err: Error) => {
      reject(err);
    };

    const onEnd = () => {
      resolve(Buffer.concat(chunks));
    };

    stream.on('data', onData);
    stream.on('error', onError);
    stream.on('end', onEnd);
  });
}

export async function sourceToBuffer(source: MediaSource): Promise<Buffer> {
  if (Buffer.isBuffer(source)) {
    return source;
  }

  if (typeof source === 'string') {
    const fs = await import('fs/promises');
    return fs.readFile(source);
  }

  if (isReadableStream(source)) {
    return streamToBuffer(source);
  }

  throw new Error('Invalid source type');
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
