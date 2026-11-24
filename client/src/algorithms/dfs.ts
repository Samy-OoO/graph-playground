import type { GraphData } from '../types/graph';
import { buildAdjacency, createLabelLookup } from '../utils/adjacency';
import type { Neighbor } from '../utils/adjacency';
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from './types';

/**
 * Depth-first search, recorded as animation frames.
 *
 * Besides node states, every frame says which edges are on the active path (the edges from the
 * start node down to the current node), which have been fully explored, and which were skipped
 * because their target was already visited.
 */
export function generateDFSSteps(graph: GraphData, startNodeId: string): AlgorithmStep[] {
  const adjacency = buildAdjacency(graph);
  if (!adjacency.has(startNodeId)) return [];

  const labelOf = createLabelLookup(graph.nodes);
  const arrow = graph.directed ? '→' : '↔';

  const steps: AlgorithmStep[] = [];
  const visited = new Set<string>();
  const finished = new Set<string>();
  const usedEdges = new Set<string>(); // every edge we have already followed or skipped
  const settledEdges = new Set<string>(); // tree edges whose subtree is done
  const callStack: string[] = [];
  const pathEdges: string[] = []; // pathEdges[i] is the edge that led into callStack[i + 1]
  const visitOrder: string[] = [];

  function record(
    message: string,
    currentNodeId: string | null,
    extras: { traversal?: EdgeTraversal; skippedEdgeId?: string } = {},
  ) {
    const nodeStatus: Record<string, NodeStatus> = {};
    for (const id of finished) nodeStatus[id] = 'visited';
    for (const id of callStack) nodeStatus[id] = 'onPath';
    if (currentNodeId) nodeStatus[currentNodeId] = 'current';

    const edgeStatus: Record<string, EdgeStatus> = {};
    for (const id of settledEdges) edgeStatus[id] = 'settled';
    for (const id of pathEdges) edgeStatus[id] = 'active';
    if (extras.skippedEdgeId) edgeStatus[extras.skippedEdgeId] = 'skipped';

    steps.push({
      message,
      nodeStatus,
      edgeStatus,
      traversal: extras.traversal ?? null,
      structure: { title: 'Call stack', kind: 'stack', items: callStack.map(labelOf) },
    });
  }

  function visit(nodeId: string, parentId: string | null, viaEdge: Neighbor | null) {
    visited.add(nodeId);
    visitOrder.push(labelOf(nodeId));
    callStack.push(nodeId);
    if (viaEdge) pathEdges.push(viaEdge.edgeId);

    if (parentId && viaEdge) {
      record(
        `Follow ${labelOf(parentId)} ${arrow} ${labelOf(nodeId)}. ${labelOf(nodeId)} is new, so visit it and go deeper.`,
        nodeId,
        { traversal: { edgeId: viaEdge.edgeId, fromNodeId: parentId } },
      );
    } else {
      record(`Start at ${labelOf(nodeId)}. Visit it and push it onto the call stack.`, nodeId);
    }

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      // In undirected graphs every edge shows up from both ends; only look at it once.
      if (usedEdges.has(neighbor.edgeId)) continue;
      usedEdges.add(neighbor.edgeId);

      if (visited.has(neighbor.nodeId)) {
        record(
          `${labelOf(nodeId)} ${arrow} ${labelOf(neighbor.nodeId)}: ${labelOf(neighbor.nodeId)} was already visited, so skip it.`,
          nodeId,
          { skippedEdgeId: neighbor.edgeId },
        );
        continue;
      }

      visit(neighbor.nodeId, nodeId, neighbor);
    }

    callStack.pop();
    if (viaEdge) {
      pathEdges.pop();
      settledEdges.add(viaEdge.edgeId);
    }
    finished.add(nodeId);

    const parentLabel = callStack.length > 0 ? labelOf(callStack[callStack.length - 1]) : null;
    if (parentLabel) {
      record(`Finished ${labelOf(nodeId)}. Backtrack to ${parentLabel}.`, nodeId);
    } else {
      const unreachable = graph.nodes.length - visitOrder.length;
      const note = unreachable > 0 ? ` ${unreachable} node${unreachable === 1 ? '' : 's'} not reachable from ${labelOf(nodeId)}.` : '';
      record(`Finished ${labelOf(nodeId)}. DFS complete. Visit order: ${visitOrder.join(', ')}.${note}`, nodeId);
    }
  }

  visit(startNodeId, null, null);
  return steps;
}
