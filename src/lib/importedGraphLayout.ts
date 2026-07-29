import type { MDNode } from '../types';

export interface ImportedGraphLayoutResult {
  nodes: MDNode[];
  nextY: number;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 210;
const FILE_GAP = 180;
const NODE_GAP = 20;

function nodeSize(node: MDNode): { width: number; height: number } {
  return node.type === 'comment'
    ? { width: node.width || 400, height: node.height || 300 }
    : { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function overlaps(a: MDNode, b: MDNode): boolean {
  const as = nodeSize(a);
  const bs = nodeSize(b);
  return a.x < b.x + bs.width + NODE_GAP
    && a.x + as.width + NODE_GAP > b.x
    && a.y < b.y + bs.height + NODE_GAP
    && a.y + as.height + NODE_GAP > b.y;
}

/**
 * Preserve the parser's semantic left-to-right layout while removing the small number of
 * collisions caused by nested cues/control bodies sharing a local coordinate.  Moving only
 * the later colliding node is substantially more readable (and far smaller) than flattening a
 * thousand-node imported script through the global Tidy Graph algorithm.
 */
export function resolveImportedGraphOverlaps(nodes: MDNode[]): MDNode[] {
  const placed: MDNode[] = [];
  for (const source of nodes) {
    const node = { ...source };
    let guard = 0;
    while (guard++ < nodes.length + 1) {
      const collisions = placed.filter(other => overlaps(node, other));
      if (!collisions.length) break;
      node.y = Math.max(...collisions.map(other => other.y + nodeSize(other).height + NODE_GAP));
    }
    placed.push(node);
  }
  return placed;
}

/**
 * Normalize one imported MD file into its own vertical canvas lane.
 *
 * Every XML parser invocation starts from the same local coordinates. Merging those batches without
 * normalization makes separate scripts occupy identical pixels. This helper preserves each file's
 * internal relative layout while moving the whole batch below the preceding file.
 */
export function layoutImportedGraphBatch(nodes: MDNode[], nextY: number, startX = 120): ImportedGraphLayoutResult {
  if (!nodes.length) return { nodes: [], nextY };
  const collisionFree = resolveImportedGraphOverlaps(nodes);
  const minX = Math.min(...collisionFree.map(node => Number.isFinite(node.x) ? node.x : 0));
  const minY = Math.min(...collisionFree.map(node => Number.isFinite(node.y) ? node.y : 0));
  const maxY = Math.max(...collisionFree.map(node => (Number.isFinite(node.y) ? node.y : 0) + nodeSize(node).height));
  const height = Math.max(NODE_HEIGHT, maxY - minY);
  return {
    nodes: collisionFree.map(node => ({
      ...node,
      x: startX + (Number.isFinite(node.x) ? node.x : 0) - minX,
      y: nextY + (Number.isFinite(node.y) ? node.y : 0) - minY,
    })),
    nextY: nextY + height + FILE_GAP,
  };
}

export function runImportedGraphLayoutSelftest(): {
  allPassed: boolean;
  passed: number;
  total: number;
  checks: Array<{ name: string; pass: boolean }>;
} {
  const node = (id: string, x: number, y: number): MDNode => ({
    id, type: 'cue', label: id, xmlTag: 'cue', x, y,
    properties: { name: id }, propertiesSchema: [], inputs: [], outputs: [],
  });
  const source = [node('a', 500, 900), node('b', 800, 1200)];
  const first = layoutImportedGraphBatch(source, 100);
  const second = layoutImportedGraphBatch([node('c', 500, 900)], first.nextY);
  const collided = [node('d', 100, 100), node('e', 100, 100), node('f', 420, 100)];
  const resolved = resolveImportedGraphOverlaps(collided);
  const checks = [
    { name: 'first_batch_normalized_to_lane_origin', pass: first.nodes[0].x === 120 && first.nodes[0].y === 100 },
    { name: 'relative_layout_preserved', pass: first.nodes[1].x - first.nodes[0].x === 300 && first.nodes[1].y - first.nodes[0].y === 300 },
    { name: 'next_file_does_not_overlap', pass: second.nodes[0].y > Math.max(...first.nodes.map(item => item.y + NODE_HEIGHT)) },
    { name: 'input_nodes_not_mutated', pass: source[0].x === 500 && source[0].y === 900 && first.nodes[0] !== source[0] },
    { name: 'same_coordinate_collision_resolved', pass: resolved[1].y >= resolved[0].y + NODE_HEIGHT + NODE_GAP },
    { name: 'non_colliding_neighbor_preserved', pass: resolved[2].x === 420 && resolved[2].y === 100 },
  ];
  return { allPassed: checks.every(check => check.pass), passed: checks.filter(check => check.pass).length, total: checks.length, checks };
}
