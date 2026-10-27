import { generateBFSSteps } from './bfs';
import { generateDFSSteps } from './dfs';
import { generateDijkstraSteps } from './dijkstra';
import { generatePrimSteps } from './prim';
import { generateBellmanFordSteps } from './bellman-ford';
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
    comingSoon: false,
    generateSteps: generateDijkstraSteps,
    legend: [
      { kind: 'node', status: 'current', label: 'Current node' },
      { kind: 'node', status: 'queued', label: 'Known distance' },
      { kind: 'node', status: 'visited', label: 'Settled' },
      { kind: 'node', status: 'default', label: 'No known distance' },
      { kind: 'edge', status: 'active', label: 'Improving path' },
      { kind: 'edge', status: 'settled', label: 'Shortest-path tree' },
      { kind: 'edge', status: 'skipped', label: 'No improvement' },
    ],
  },
  {
    id: 'bellman-ford',
    label: 'Bellman-Ford',
    summary: 'Shortest path from one node in a graph with possible negative edge weights',
    complexity: 'O(V + E)',
    comingSoon: false,
    generateSteps: generateBellmanFordSteps,
    legend: [
      { kind: 'node', status: 'current', label: 'Node being updated' },
      { kind: 'node', status: 'queued', label: 'Has a distance' },
      { kind: 'node', status: 'visited', label: 'Final distance' },
      { kind: 'node', status: 'default', label: 'No distance yet (∞)' },
      { kind: 'edge', status: 'active', label: 'Relaxed (improved)' },
      { kind: 'edge', status: 'settled', label: 'Current shortest-path edge' },
      { kind: 'edge', status: 'skipped', label: 'No improvement' },
    ],
  },
  {
    id: 'floyd-warshall',
    label: 'Floyd-Warshall',
    summary: 'Shortest distance between each pair of edges.',
    complexity: 'O(V³)',
    comingSoon: true,
    generateSteps: null,
    legend: [],
  },
  {
    id: 'prim',
    label: "Prim",
    summary: 'Grows a Minimum Spanning Tree from a random node by always taking the cheapest edge that reaches a new node.',
    complexity: 'O(E log V)',
    comingSoon: false,
    randomStart: true,
    generateSteps: generatePrimSteps,
    legend: [
      { kind: 'node', status: 'current', label: 'Newly added' },
      { kind: 'node', status: 'queued', label: 'Reachable by a queued edge' },
      { kind: 'node', status: 'visited', label: 'In the tree' },
      { kind: 'node', status: 'default', label: 'Not reached yet' },
      { kind: 'edge', status: 'active', label: 'Cheapest edge to a new node' },
      { kind: 'edge', status: 'settled', label: 'Tree edge' },
      { kind: 'edge', status: 'skipped', label: 'Skipped (would form a cycle)' },
    ],
  },
  {
    id: 'kruskal',
    label: 'Kruskal',
    summary: 'Grows a Minimum Spanning Tree/Forest, starting from the least weighted edge to the greatest.',
    complexity: 'O(E log V)',
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
