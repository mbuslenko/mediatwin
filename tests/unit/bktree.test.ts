import { describe, it, expect, beforeEach } from 'vitest';
import { BKTree } from '../../src/storage/redis/bktree';

describe('BKTree', () => {
  let tree: BKTree;

  beforeEach(() => {
    tree = new BKTree();
  });

  describe('insert', () => {
    it('inserts single node as root', () => {
      tree.insert('0000000000000000', 'media1');
      expect(tree.size()).toBe(1);
    });

    it('inserts multiple nodes', () => {
      tree.insert('0000000000000000', 'media1');
      tree.insert('0000000000000001', 'media2');
      tree.insert('000000000000000f', 'media3');
      expect(tree.size()).toBe(3);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      tree.insert('0000000000000000', 'exact');
      tree.insert('0000000000000001', 'dist1');
      tree.insert('000000000000000f', 'dist4');
      tree.insert('00000000000000ff', 'dist8');
      tree.insert('ffffffffffffffff', 'opposite');
    });

    it('finds exact match with threshold 0', () => {
      const results = tree.search('0000000000000000', 0);
      expect(results).toHaveLength(1);
      expect(results[0].mediaId).toBe('exact');
      expect(results[0].distance).toBe(0);
    });

    it('finds matches within threshold', () => {
      const results = tree.search('0000000000000000', 4);
      expect(results).toHaveLength(3); // exact, dist1, dist4
      expect(results.map((r) => r.mediaId)).toContain('exact');
      expect(results.map((r) => r.mediaId)).toContain('dist1');
      expect(results.map((r) => r.mediaId)).toContain('dist4');
    });

    it('returns empty array when no matches', () => {
      const results = tree.search('aaaaaaaaaaaaaaaa', 0);
      expect(results).toHaveLength(0);
    });

    it('returns results sorted by distance', () => {
      const results = tree.search('0000000000000000', 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });

    it('returns empty array for empty tree', () => {
      const emptyTree = new BKTree();
      const results = emptyTree.search('0000000000000000', 10);
      expect(results).toHaveLength(0);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      tree.insert('0000000000000000', 'media1');
      tree.insert('0000000000000001', 'media2');
      tree.insert('0000000000000003', 'media3');
    });

    it('removes existing node', () => {
      expect(tree.size()).toBe(3);
      const removed = tree.remove('media2');
      expect(removed).toBe(true);
      expect(tree.size()).toBe(2);
    });

    it('returns false for non-existent node', () => {
      const removed = tree.remove('nonexistent');
      expect(removed).toBe(false);
      expect(tree.size()).toBe(3);
    });

    it('removed node is not found in search', () => {
      tree.remove('media1');
      const results = tree.search('0000000000000000', 0);
      expect(results.find((r) => r.mediaId === 'media1')).toBeUndefined();
    });
  });

  describe('serialize/deserialize', () => {
    it('serializes empty tree', () => {
      const data = tree.serialize();
      expect(data.nodes).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    it('serializes and deserializes tree', () => {
      tree.insert('0000000000000000', 'media1');
      tree.insert('0000000000000001', 'media2');
      tree.insert('000000000000000f', 'media3');

      const data = tree.serialize();
      expect(data.nodes).toHaveLength(3);
      expect(data.count).toBe(3);

      const restored = BKTree.deserialize(data);
      expect(restored.size()).toBe(3);

      const results = restored.search('0000000000000000', 5);
      expect(results).toHaveLength(3);
    });

    it('preserves tree structure after serialization', () => {
      tree.insert('8000000000000000', 'media1');
      tree.insert('0000000000000000', 'media2');
      tree.insert('ffffffffffffffff', 'media3');

      const data = tree.serialize();
      const restored = BKTree.deserialize(data);

      const results1 = restored.search('8000000000000000', 64);
      expect(results1.map((r) => r.mediaId).sort()).toEqual(['media1', 'media2', 'media3']);
    });
  });

  describe('fromEntries', () => {
    it('builds tree from entries array', () => {
      const entries = [
        { hash: '0000000000000000', mediaId: 'media1' },
        { hash: '0000000000000001', mediaId: 'media2' },
        { hash: '000000000000000f', mediaId: 'media3' },
      ];

      const builtTree = BKTree.fromEntries(entries);
      expect(builtTree.size()).toBe(3);

      const results = builtTree.search('0000000000000000', 5);
      expect(results).toHaveLength(3);
    });
  });

  describe('getStats', () => {
    it('returns correct stats for empty tree', () => {
      const stats = tree.getStats();
      expect(stats.depth).toBe(0);
      expect(stats.avgBranchingFactor).toBe(0);
    });

    it('returns correct stats for populated tree', () => {
      tree.insert('0000000000000000', 'media1');
      tree.insert('0000000000000001', 'media2');
      tree.insert('0000000000000003', 'media3');
      tree.insert('0000000000000007', 'media4');

      const stats = tree.getStats();
      expect(stats.depth).toBeGreaterThan(0);
    });
  });
});
