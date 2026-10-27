import type { GraphData } from '../types/graph';

export type AlgorithmId = 'none' | 'bfs' | 'dfs' | 'dijkstra' | 'bellman-ford' | 'floyd-warshall' | 'prim' | 'kruskal' | 'topo-sort';

/**
 * How a node should look in a given step.
 * - current: the node being worked on right now
 * - queued: discovered, waiting its turn (BFS queue)
 * - onPath: on the active recursion path (DFS call stack)
 * - visited: fully done
 */
export type NodeStatus = 'default' | 'current' | 'queued' | 'onPath' | 'visited';

/**
 * How an edge should look in a given step.
 * - active: part of the path being followed right now
 * - settled: already explored; part of the finished tree
 * - skipped: looked at, but not followed (target already visited)
 */
export type EdgeStatus = 'default' | 'active' | 'settled' | 'skipped';

/** Contents of the helper structure (call stack, queue, …) shown next to the canvas. */
export interface StructureSnapshot {
  title: string;
  kind: 'stack' | 'queue';
  /** Node labels. Stacks: bottom first, top last. Queues: front first. */
  items: string[];
}

/** The edge being walked in this step, and which end the walk starts from. */
export interface EdgeTraversal {
  edgeId: string;
  fromNodeId: string;
}

/**
 * One frame of an algorithm run. The UI knows nothing about BFS or DFS: it only draws
 * these frames. Only non-default statuses need to be listed.
 */
export interface AlgorithmStep {
  message: string;
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  traversal: EdgeTraversal | null;
  structure: StructureSnapshot | null;
}

export type LegendItem =
  | { kind: 'node'; status: NodeStatus; label: string }
  | { kind: 'edge'; status: EdgeStatus; label: string };

export interface AlgorithmDefinition {
  id: AlgorithmId;
  label: string;
  summary: string;
  complexity: string;
  /** Listed in the picker but not built yet. */
  comingSoon: boolean;
  randomStart?: boolean;
  generateSteps: ((graph: GraphData, startNodeId: string) => AlgorithmStep[]) | null;
  legend: LegendItem[];
}
