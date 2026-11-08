import type { GraphData } from '../types/graph';

export type AlgorithmId = 'none' | 'bfs' | 'dfs' | 'dijkstra' | 'bellman-ford' | 'floyd-warshall' | 'prim' | 'kruskal' | 'topo-sort' | 'eulerian';

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

/** A table of values, such as the distance between every pair of nodes */
export interface MatrixSnapshot {
  columnLabels: string[];
  rows: { label: string; cells: string[] }[];
  /** Index of the row and column to tint (the intermediate node in Floyd-Warshall). */
  pivot?: number;
  /** The cell being checked, and whether it just changed. */
  focus?: { row: number; column: number; updated: boolean };
}

/** Contents of the helper structure (call stack, queue, …) shown next to the canvas. */
export interface StructureSnapshot {
  title: string;
  kind: 'stack' | 'queue' | 'matrix';
  /** Node labels. Stacks: bottom first, top last. Queues: front first. */
  items: string[];
  /** Only for kind 'matrix' */
  matrix?: MatrixSnapshot;
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
  startHint?: string;
  generateSteps: ((graph: GraphData, startNodeId: string) => AlgorithmStep[]) | null;
  legend: LegendItem[];
}
