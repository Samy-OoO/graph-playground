import { generateBFSSteps } from './bfs';
import { generateDFSSteps } from './dfs';
import type { AlgorithmDefinition, AlgorithmId } from './types';

/**
 * The algorithm registry. To add an algorithm: write a `generate…Steps` function that returns
 * AlgorithmStep frames, then add one entry here. The picker, controls, canvas and legend pick it up.
 */
export const ALGORITHMS: AlgorithmDefinition[] = [
  {
    id: 'none',
    label: 'None',
    summary: '',
    complexity: '',
    comingSoon: false,
    generateSteps: null,
    legend: [],
  },
  {
    id: 'bfs',
    label: 'BFS',
    summary: 'Visits nodes level by level using a queue. In an unweighted graph it finds the fewest-edge path to every node.',
    complexity: 'O(V + E)',
    comingSoon: false,
    generateSteps: generateBFSSteps,
    legend: [
      { kind: 'node', status: 'current', label: 'Current' },
      { kind: 'node', status: 'queued', label: 'In queue' },
      { kind: 'node', status: 'visited', label: 'Visited' },
      { kind: 'node', status: 'default', label: 'Unreached' },
      { kind: 'edge', status: 'active', label: 'Discovering' },
      { kind: 'edge', status: 'settled', label: 'Tree edge' },
    ],
  },
  {
    id: 'dfs',
    label: 'DFS',
    summary: 'Follows one branch as deep as it can, then backtracks. The recursion path is the call stack.',
    complexity: 'O(V + E)',
    comingSoon: false,
    generateSteps: generateDFSSteps,
    legend: [
      { kind: 'node', status: 'current', label: 'Current' },
      { kind: 'node', status: 'onPath', label: 'On the call stack' },
      { kind: 'node', status: 'visited', label: 'Finished' },
      { kind: 'node', status: 'default', label: 'Unvisited' },
      { kind: 'edge', status: 'active', label: 'Active path' },
      { kind: 'edge', status: 'settled', label: 'Explored' },
      { kind: 'edge', status: 'skipped', label: 'Skipped (already visited)' },
    ],
  },
  {
    id: 'dijkstra',
    label: 'Dijkstra',
    summary: 'Shortest paths from one node in a graph with non-negative weights.',
    complexity: 'O((V + E) log V)',
    comingSoon: true,
    generateSteps: null,
    legend: [],
  },
  {
    id: 'topo-sort',
    label: 'Topological Sort',
    summary: 'Orders the nodes of a directed acyclic graph so every edge points forward.',
    complexity: 'O(V + E)',
    comingSoon: true,
    generateSteps: null,
    legend: [],
  },
];

export function getAlgorithm(id: AlgorithmId): AlgorithmDefinition {
  return ALGORITHMS.find((algorithm) => algorithm.id === id) ?? ALGORITHMS[0];
}
