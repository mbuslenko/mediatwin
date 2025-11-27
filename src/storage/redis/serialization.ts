import type { MediaEntry, ComputedHashes } from '../../types/media';

export function serializeMediaEntry(entry: MediaEntry): Record<string, string> {
  return {
    id: entry.id,
    type: entry.type,
    hashes: JSON.stringify(entry.hashes),
    metadata: JSON.stringify(entry.metadata),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function deserializeMediaEntry(data: Record<string, string>): MediaEntry | null {
  if (!data || !data.id) {
    return null;
  }

  return {
    id: data.id,
    type: data.type as 'image' | 'video',
    hashes: JSON.parse(data.hashes || '{}') as ComputedHashes,
    metadata: JSON.parse(data.metadata || '{}') as Record<string, unknown>,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

export function mediaKey(namespace: string, mediaId: string): string {
  return `mediatwin:${namespace}:media:${mediaId}`;
}

export function bkTreeKey(namespace: string, hashType: string): string {
  return `mediatwin:${namespace}:bktree:${hashType}:data`;
}

export function mediaKeyPattern(namespace: string): string {
  return `mediatwin:${namespace}:media:*`;
}
