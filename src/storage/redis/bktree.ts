import { hammingDistance } from '../../utils/hash-utils';
import type { BKTreeData, SerializedBKTreeNode } from '../types';

export interface BKTreeSearchResult {
  mediaId: string;
  hash: string;
  distance: number;
}

interface BKTreeNode {
  /** (hex string) */
  hash: string;
  mediaId: string;
  /** Children: distance -> child node */
  children: Map<number, BKTreeNode>;
}

/**
 * In-memory BK-tree for similarity search
 *
 * BK-tree is a metric tree designed for discrete metric spaces.
 * Average search complexity is O(n^α) where α < 1
 */
export class BKTree {
  private root: BKTreeNode | null = null;
  private nodeCount = 0;

  insert(hash: string, mediaId: string): void {
    const newNode: BKTreeNode = {
      hash,
      mediaId,
      children: new Map(),
    };

    if (!this.root) {
      this.root = newNode;
      this.nodeCount = 1;
      return;
    }

    let current = this.root;

    while (true) {
      const distance = hammingDistance(hash, current.hash);

      // ff same distance child exists, traverse down
      const child = current.children.get(distance);

      if (child) {
        current = child;
      } else {
        current.children.set(distance, newNode);
        this.nodeCount++;
        return;
      }
    }
  }

  search(queryHash: string, threshold: number): BKTreeSearchResult[] {
    const results: BKTreeSearchResult[] = [];

    if (!this.root) {
      return results;
    }

    const stack: BKTreeNode[] = [this.root];

    while (stack.length > 0) {
      const node = stack.pop()!;
      const distance = hammingDistance(queryHash, node.hash);

      if (distance <= threshold) {
        results.push({
          mediaId: node.mediaId,
          hash: node.hash,
          distance,
        });
      }

      // due to triangle inequality, only check children within [distance - threshold, distance + threshold]
      const minDistance = Math.max(0, distance - threshold);
      const maxDistance = distance + threshold;

      for (const [childDistance, child] of node.children) {
        if (childDistance >= minDistance && childDistance <= maxDistance) {
          stack.push(child);
        }
      }
    }

    results.sort((a, b) => a.distance - b.distance);

    return results;
  }

  /**
   * Remove a hash from the tree
   * Note: BK-tree removal is complex, so we rebuild the tree without the removed node
   */
  remove(mediaId: string): boolean {
    if (!this.root) {
      return false;
    }

    // collect all nodes except the one to remove
    const nodes: Array<{ hash: string; mediaId: string }> = [];
    let found = false;

    const collectNodes = (node: BKTreeNode): void => {
      if (node.mediaId === mediaId) {
        found = true;
      } else {
        nodes.push({ hash: node.hash, mediaId: node.mediaId });
      }

      for (const child of node.children.values()) {
        collectNodes(child);
      }
    };

    collectNodes(this.root);

    if (!found) {
      return false;
    }

    // rebuild tree
    this.root = null;
    this.nodeCount = 0;

    for (const node of nodes) {
      this.insert(node.hash, node.mediaId);
    }

    return true;
  }

  size(): number {
    return this.nodeCount;
  }

  isEmpty(): boolean {
    return this.root === null;
  }

  serialize(): BKTreeData {
    const nodes: SerializedBKTreeNode[] = [];
    const nodeIndexMap = new Map<BKTreeNode, number>();

    if (!this.root) {
      return {
        nodes: [],
        count: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    const assignIndex = (node: BKTreeNode): void => {
      nodeIndexMap.set(node, nodes.length);
      nodes.push({
        hash: node.hash,
        mediaId: node.mediaId,
        children: {},
      });

      for (const child of node.children.values()) {
        assignIndex(child);
      }
    };

    assignIndex(this.root);

    const fillChildren = (node: BKTreeNode): void => {
      const index = nodeIndexMap.get(node)!;

      for (const [distance, child] of node.children) {
        const childIndex = nodeIndexMap.get(child)!;
        nodes[index].children[distance] = childIndex;
      }

      for (const child of node.children.values()) {
        fillChildren(child);
      }
    };

    fillChildren(this.root);

    return {
      nodes,
      count: this.nodeCount,
      updatedAt: new Date().toISOString(),
    };
  }

  static deserialize(data: BKTreeData): BKTree {
    const tree = new BKTree();

    if (!data.nodes || data.nodes.length === 0) {
      return tree;
    }

    // create all nodes
    const nodes: BKTreeNode[] = data.nodes.map((n) => ({
      hash: n.hash,
      mediaId: n.mediaId,
      children: new Map(),
    }));

    // connect children
    for (let i = 0; i < data.nodes.length; i++) {
      const serialized = data.nodes[i];
      const node = nodes[i];

      for (const [distStr, childIndex] of Object.entries(serialized.children)) {
        const distance = parseInt(distStr, 10);
        node.children.set(distance, nodes[childIndex]);
      }
    }

    tree.root = nodes[0];
    tree.nodeCount = data.count;

    return tree;
  }

  /**
   * Build tree from array of entries
   */
  static fromEntries(entries: Array<{ hash: string; mediaId: string }>): BKTree {
    const tree = new BKTree();

    for (const entry of entries) {
      tree.insert(entry.hash, entry.mediaId);
    }

    return tree;
  }

  getStats(): { depth: number; avgBranchingFactor: number } {
    if (!this.root) {
      return { depth: 0, avgBranchingFactor: 0 };
    }

    let maxDepth = 0;
    let totalChildren = 0;
    let nonLeafNodes = 0;

    const traverse = (node: BKTreeNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);

      if (node.children.size > 0) {
        nonLeafNodes++;
        totalChildren += node.children.size;
      }

      for (const child of node.children.values()) {
        traverse(child, depth + 1);
      }
    };

    traverse(this.root, 1);

    return {
      depth: maxDepth,
      avgBranchingFactor: nonLeafNodes > 0 ? totalChildren / nonLeafNodes : 0,
    };
  }
}
