import type { GraphData } from '../types/graph';
import { buildAdjacency, createLabelLookup } from '../utils/adjacency';
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from './types';

/** Breadth-first search, recorded as animation frames. */
export function generateBFSSteps(graph: GraphData, startNodeId: string): AlgorithmStep[] {
  const adjacency = buildAdjacency(graph);
  if (!adjacency.has(startNodeId)) return [];

  const labelOf = createLabelLookup(graph.nodes);

  const steps: AlgorithmStep[] = [];
  const queue: string[] = [startNodeId];
  let head = 0; // queue[head..] is what is still waiting
  const discovered = new Set<string>([startNodeId]);
  const visited = new Set<string>();
  const treeEdges = new Set<string>();
  const visitOrder: string[] = [];

  function record(message: string, currentNodeId: string | null, traversal?: EdgeTraversal) {
    const waiting = queue.slice(head);

    const nodeStatus: Record<string, NodeStatus> = {};
    for (const id of waiting) nodeStatus[id] = 'queued';
    for (const id of visited) nodeStatus[id] = 'visited';
    if (currentNodeId) nodeStatus[currentNodeId] = 'current';

    const edgeStatus: Record<string, EdgeStatus> = {};
    for (const id of treeEdges) edgeStatus[id] = 'settled';
    if (traversal) edgeStatus[traversal.edgeId] = 'active';

    steps.push({
      message,
      nodeStatus,
      edgeStatus,
      traversal: traversal ?? null,
      structure: { title: 'Queue', kind: 'queue', items: waiting.map(labelOf) },
    });
  }

  record(`Start at ${labelOf(startNodeId)}. Add it to the queue.`, null);

  while (head < queue.length) {
    const current = queue[head++];
    visited.add(current);
    visitOrder.push(labelOf(current));
    record(`Take ${labelOf(current)} off the queue and visit it.`, current);

    for (const neighbor of adjacency.get(current) ?? []) {
      if (discovered.has(neighbor.nodeId)) continue;

      discovered.add(neighbor.nodeId);
      queue.push(neighbor.nodeId);
      treeEdges.add(neighbor.edgeId);
      record(
        `Discovered ${labelOf(neighbor.nodeId)} from ${labelOf(current)}. Add it to the queue.`,
        current,
        { edgeId: neighbor.edgeId, fromNodeId: current },
      );
    }
  }

  const unreachable = graph.nodes.length - visitOrder.length;
  const note = unreachable > 0 ? ` ${unreachable} node${unreachable === 1 ? '' : 's'} not reachable from ${labelOf(startNodeId)}.` : '';
  record(`BFS complete. Visit order: ${visitOrder.join(', ')}.${note}`, null);

  return steps;
}
