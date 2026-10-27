import type { GraphData } from "../types/graph";
import { createLabelLookup } from "../utils/adjacency";
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from "./types";

type DirectedEdge = { edgeId: string, fromNodeId: string, toNodeId: string, weight: number };

/* Bellman-Ford's algorithm recorded as animation frames*/
export function generateBellmanFordSteps(graph: GraphData, startNodeId: string) : AlgorithmStep[] {
    if (!graph.nodes.some((node) => node.id === startNodeId)) return [];

    const labelOf = createLabelLookup(graph.nodes);

    // Iterating over a flat list of edges.
    const edges: DirectedEdge[] = [];
    for (const edge of graph.edges) {
        const weight = graph.weighted ? (edge.weight ?? 1) : 1;
        edges.push({ edgeId: edge.id, fromNodeId: edge.source, toNodeId: edge.destination, weight: weight });
        if (!graph.directed) edges.push({ edgeId: edge.id, fromNodeId: edge.destination, toNodeId: edge.source, weight: weight });
    }

    const steps: AlgorithmStep[] = [];
    const distances = new Map<string, number>( graph.nodes.map((node) => [node.id, Infinity]) );
    const previousEdge = new Map<string, string>();
    let finished = false;

    distances.set(startNodeId, 0);


    function formatNumber(val: number): string {
        return Number.isFinite(val) ? String(Number(val.toFixed(3))) : '∞';
    }

    // Bracketing negative numbers so "0 + -2" reads clearly.
    const bracketed = (value: number) => (value < 0 ? `(${formatNumber(value)})` : formatNumber(value));

    function record(
        message: string,
        curNodeId: string | null,
        extras: { traversal?: EdgeTraversal; activeEdgeId?: string; skippedEdgeId?: string } = {}
    ) {
        // Node Status
        const nodeStatus: Record<string, NodeStatus> = {};
        for (const node of graph.nodes) {
            if (Number.isFinite(distances.get(node.id)!)) nodeStatus[node.id] = finished ? 'visited' : 'queued';
        }
        if (curNodeId) nodeStatus[curNodeId] = 'current';

        // Edge Status
        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const edgeId of previousEdge.values()) edgeStatus[edgeId] = 'settled';
        if (extras.skippedEdgeId && edgeStatus[extras.skippedEdgeId] !== 'settled') {
            edgeStatus[extras.skippedEdgeId] = 'skipped';
        }
        if (extras.activeEdgeId) edgeStatus[extras.activeEdgeId] = 'active';

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Distances',
                kind: 'queue',
                items: graph.nodes.map((node) => `${labelOf(node.id)}: ${formatNumber(distances.get(node.id)!)}`),
            }
        });
    }

    // A shortest path uses at most (V - 1) edges, so (V - 1) passes over all the edges are enough.
    const passCount = graph.nodes.length - 1;
    let settledEarly = false;

    record(`Start at ${labelOf(startNodeId)} with distance 0. Every other distance is ∞.`, startNodeId);
    // Main algo
    for (let pass = 1; pass <= passCount; pass++) {
        record(`Pass ${pass} of ${passCount}: try to relax every edge once.`, null);
        let changed = false;

        for (const { edgeId, fromNodeId, toNodeId, weight } of edges) {
            const traversal: EdgeTraversal = { edgeId, fromNodeId };
            const from = labelOf(fromNodeId);
            const to = labelOf(toNodeId);
            const fromDistance = distances.get(fromNodeId)!;
            const toDistance = distances.get(toNodeId)!;

            if (!Number.isFinite(fromDistance)) {
                record(`${from} → ${to}: ${from} has no distance yet, so there is nothing to relax.`, toNodeId, {
                    traversal,
                    skippedEdgeId: edgeId,
                });
                continue;
            }

            const newDistance = fromDistance + weight;

            if (newDistance < toDistance) {
                distances.set(toNodeId, newDistance);
                previousEdge.set(toNodeId, edgeId);
                changed = true;
                record(
                    `Relax edge ${from} → ${to}: ${formatNumber(fromDistance)} + ${weight < 0 ? bracketed(weight) : weight} = ${formatNumber(newDistance)} ` + 
                    `beats ${formatNumber(toDistance)}, so update ${to}.`,
                    toNodeId,
                    { traversal, activeEdgeId: edgeId },
                );
            }
            else {
                record(
                    `${from} → ${to}: ${formatNumber(fromDistance)} + ${weight < 0 ? bracketed(weight) : weight} = ${formatNumber(newDistance)} ` + 
                    `is not better than ${formatNumber(toDistance)}. Keep it.`,
                    toNodeId,
                    { traversal, skippedEdgeId: edgeId },
                );
            }

        }

        if (!changed) {
            settledEarly = true;
            record(`No distance changed in pass ${pass}, so, every distance is final. Stop early.`, null);
            break;
        }
    }

    if (!settledEarly) {
        record(`Extra check: if any edge can still be relaxed, there is a negative cycle.`, null);

        for (const { edgeId, fromNodeId, toNodeId, weight } of edges) {
            const fromDistance = distances.get(fromNodeId)!;
            const toDistance = distances.get(toNodeId)!;

            if (Number.isFinite(fromDistance) && fromDistance + weight < toDistance) {
                record(
                    `${labelOf(fromNodeId)} → ${labelOf(toNodeId)} can still improve ${labelOf(toNodeId)} ` + 
                    `(${formatNumber(fromDistance + weight)} < ${formatNumber(toDistance)}). ` + 
                    `Shortest paths have at most ${passCount} edges, so a negative cycle is reachable from ` + 
                    `${labelOf(startNodeId)} and no shortest distance exists.`,
                    toNodeId,
                    { traversal: { edgeId, fromNodeId }, activeEdgeId: edgeId },
                );
                return steps;
            }
        }
    }

    finished = true;
    const unreachable = graph.nodes.filter((node) => !Number.isFinite(distances.get(node.id)!)).length;
    const summary = graph.nodes.map((node) => `${labelOf(node.id)}: ${formatNumber(distances.get(node.id)!)}`).join(', ');
    const note = unreachable > 0
        ? ` ${unreachable} node${unreachable === 1 ? '' : 's'} not reachable from ${labelOf(startNodeId)}.`
        : '';
    
    record(`Bellman-Ford complete. Final distances: ${summary}.${note}`, null);

    return steps;
}