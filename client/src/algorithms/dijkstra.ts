import { MinPriorityQueue } from '@datastructures-js/priority-queue';

import type { GraphData } from '../types/graph';
import { buildAdjacency, createLabelLookup } from '../utils/adjacency';
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from './types';

type QueueEntry = { nodeId: string, distance: number };

/* Dijkstra's Algorithm, recorded as animation frames. */
export function generateDijkstraSteps(graph: GraphData, startNodeId: string) : AlgorithmStep[] {

    const adjacency = buildAdjacency(graph);
    if (!adjacency.has(startNodeId)) return [];

    const labelOf = createLabelLookup(graph.nodes);
    const arrow = graph.directed ? '→' : '↔';
    
    const steps: AlgorithmStep[] = [];
    const distances = new Map<string, number>( graph.nodes.map((node) => [node.id, Infinity]) );
    const previousEdge = new Map<string, string>();
    const visited = new Set<string>();
    const visitOrder: string[] = [];
    const settledEdges = new Set<string>();

    distances.set(startNodeId, 0);

    // Dijkstra's requires non-negative, finite weights.
    if (graph.weighted) 
        {
        const invalidEdge = graph.edges.find((edge) => {
            const weight = edge.weight ?? 1;
            return !Number.isFinite(weight) || weight < 0;
        });

        if (invalidEdge) {
            const weight = invalidEdge.weight ?? 1;
            const message = weight < 0 ? `Dijkstra can't use negative edge weights. Edge ${labelOf(invalidEdge.source)} ${arrow} ${labelOf(invalidEdge.destination)} has weight ${weight}.`
                                       : `Dijkstra requires finite edge weights. Edge ${labelOf(invalidEdge.source)} ${arrow} ${labelOf(invalidEdge.destination)} has infinite weight.`
        
            return [{
                message,
                nodeStatus: {},
                edgeStatus: {},
                traversal: null,
                structure: null,
            }];
        }
    }

    
    const minHeap = new MinPriorityQueue<QueueEntry>( (entry) => entry.distance, );

    minHeap.enqueue({ nodeId: startNodeId, distance: 0 })

    function formatDistance(distance: number) : string {
        return Number.isFinite(distance) ? String(Number(distance.toFixed(3))) : '∞';
    }

    function record(message: string, currentNodeId: string | null, extras: {
        traversal?: EdgeTraversal;
        activeEdgeIds?: string[];
        skippedEdgeIds?: string[];
    } = {},
    ) {
        // Node Status
        const queueEntries = minHeap.toArray()
            .filter(({ nodeId, distance }) => !visited.has(nodeId) && distance === distances.get(nodeId))
            .sort((a, b) => a.distance - b.distance);
        const nodeStatus: Record<string, NodeStatus> = {};

        for (const entry of queueEntries) {
            if (!visited.has(entry.nodeId)) nodeStatus[entry.nodeId] = 'queued';
        }
        for (const id of visited) nodeStatus[id] = 'visited';
        if (currentNodeId) nodeStatus[currentNodeId] = 'current';

        // Edge Status
        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const edgeId of settledEdges) edgeStatus[edgeId] = 'settled';
        for (const edgeId of extras.skippedEdgeIds ?? []) {
            if (!settledEdges.has(edgeId)) edgeStatus[edgeId] = 'skipped';
        }
        for(const edgeId of extras.activeEdgeIds ?? []) {
            if (!settledEdges.has(edgeId)) edgeStatus[edgeId] = 'active';
        }

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Priority queue',
                kind: 'queue',
                items: queueEntries.map(
                    ({ nodeId, distance }) => `${labelOf(nodeId)} (${formatDistance(distance)})`,
                ),
            },
        });
    }

    record(`Start at ${labelOf(startNodeId)} with distance 0. Add it to the Min-Heap. All other distances are ∞.`, null);


    // Select the unsettled node with the smallest known distance.
    // Use Min-Heap PriorityQueue.
    while(!minHeap.isEmpty()) {
        const entry = minHeap.dequeue();
        if (!entry) break;

        const { nodeId: cur, distance } = entry;

        // Ignore outdated entries left behind after a better distance was found.
        if (distance !== distances.get(cur) || visited.has(cur)) continue;

        visited.add(cur);
        visitOrder.push(labelOf(cur));

        const previousEdgeId = previousEdge.get(cur);
        if (previousEdgeId) settledEdges.add(previousEdgeId);

        record(`Take ${labelOf(cur)} from the Min-Heap and settle it at the distance ${distance}.`, cur,);

        // Relax every edge that leaves cur in one go, so its whole neighbourhood lights up in a single frame.
        // Edges that lead to settled nodes are finished business, so they are left out.
        const improved: string[] = [];
        const kept: string[] = [];
        const improvedEdgeIds: string[] = [];
        const keptEdgeIds: string[] = [];

        for (const nei of adjacency.get(cur) ?? []) {
            if (visited.has(nei.nodeId)) continue;

            const weight = graph.weighted ? (nei.weight ?? 1) : 1;
            const candidateDistance = distance + weight;
            const previousDistance = distances.get(nei.nodeId)!;            

            if (candidateDistance < previousDistance) {
                distances.set(nei.nodeId, candidateDistance);
                previousEdge.set(nei.nodeId, nei.edgeId);

                // Insert the improved distance. Older entries become stale automatically.
                minHeap.enqueue({ nodeId: nei.nodeId, distance: candidateDistance, });

                improved.push(`${labelOf(nei.nodeId)} ${formatDistance(previousDistance)} → ${formatDistance(candidateDistance)}`);
                improvedEdgeIds.push(nei.edgeId);
            }
            else {
                kept.push(
                    `${labelOf(nei.nodeId)} stays at ${formatDistance(previousDistance)} ` + 
                    `(${formatDistance(candidateDistance)} is not better)`,
                );
                keptEdgeIds.push(nei.edgeId);
            }
        }

        if (improved.length > 0 || kept.length > 0) {
            const parts = [`Relax the edges from ${labelOf(cur)}.`];
            if (improved.length > 0) parts.push(`Improved: ${improved.join(', ')}.`);
            if (kept.length > 0) parts.push(`No improvement: ${kept.join(', ')}.`);
            
            record(parts.join(' '), cur, { activeEdgeIds: improvedEdgeIds, skippedEdgeIds: keptEdgeIds });
        }
    }

    const unreachable = graph.nodes.length - visitOrder.length;

    const distanceSummary = graph.nodes
        .map((node) => `${labelOf(node.id)}: ${formatDistance(distances.get(node.id)!)}`)
        .join(', ');

    const note = unreachable > 0
        ? ` ${unreachable} node${unreachable === 1 ? '' : 's'} not reachable from ${labelOf(startNodeId)}.`
        : '';

    record(`Dijkstra complete. Final distances: ${distanceSummary}.${note}`, null, );

    return steps;

}