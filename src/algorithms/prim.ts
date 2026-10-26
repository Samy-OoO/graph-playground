import { MinPriorityQueue } from "@datastructures-js/priority-queue";

import type { GraphData } from "../types/graph";
import { buildAdjacency, createLabelLookup } from "../utils/adjacency";
import type { AlgorithmStep, NodeStatus, EdgeStatus, EdgeTraversal } from "./types";

type QueueEntry = { nodeId: string, fromNodeId: string, edgeId: string, weight: number };

export function generatePrimSteps(graph: GraphData, startNodeId: string) : AlgorithmStep[] {

    const adjacency = buildAdjacency(graph);
    if (!adjacency.has(startNodeId)) return [];

    // A spanning tree only makes sense for an undirected graph.
    if (graph.directed) {
        return [{
            message: `Prim's algorithm needs an undirected graph. Turn off 'directed' to run it.`,
            nodeStatus: {},
            edgeStatus: {},
            traversal: null,
            structure: null,
        }];
    }


    const labelOf = createLabelLookup(graph.nodes);
    const edgeLabel = (fromNodeId: string, toNodeId: string) => `${labelOf(fromNodeId)} ↔ ${labelOf(toNodeId)}`;

    const steps: AlgorithmStep[] = [];
    const inTree = new Set<string>();
    const treeEdges = new Set<string>();
    const treeEdgeLabels: string[] = [];
    let totalWeight = 0;
    let treeCount = 0;

    const minHeap = new MinPriorityQueue<QueueEntry>((entry) => entry.weight);
    
    function formatWeight(weight: number): string {
        return Number.isFinite(weight) ? String(Number(weight.toFixed(3))) : '∞';
    }

    function record(message: string, curNodeId: string | null, extras: {
        traversal?: EdgeTraversal;
        activeEdgeId?: string;
        skippedEdgeId?: string;
    } = {}) {
        const queueEntries = minHeap.toArray();

        const nodeStatus: Record<string, NodeStatus> = {};
        for (const entry of queueEntries) {
            if (!inTree.has(entry.nodeId)) nodeStatus[entry.nodeId] = 'queued';
        }
        for (const id of inTree) nodeStatus[id] = 'visited';
        if (curNodeId) nodeStatus[curNodeId] = 'current';

        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const id of treeEdges) edgeStatus[id] = 'settled';
        if (extras.skippedEdgeId) edgeStatus[extras.skippedEdgeId] = 'skipped';
        if (extras.activeEdgeId) edgeStatus[extras.activeEdgeId] = 'active';

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Priority queue',
                kind: 'queue',
                items: queueEntries.map((entry) => `${edgeLabel(entry.fromNodeId, entry.nodeId)} (${formatWeight(entry.weight)})`),
            },
        });
    }

    // Queues neighbors 
    function queueEdgesFrom(nodeId: string) {
        for (const nei of adjacency.get(nodeId) ?? []) {
            if (inTree.has(nei.nodeId)) continue;
            
            const weight = graph.weighted ? (nei.weight ?? 1) : 1;
            minHeap.enqueue({ nodeId: nei.nodeId, fromNodeId: nodeId, edgeId: nei.edgeId, weight });
            record(
                `Queue ${edgeLabel(nodeId, nei.nodeId)} (${formatWeight(weight)}).`,
                nodeId,
                { traversal: { edgeId: nei.edgeId, fromNodeId: nodeId }, activeEdgeId: nei.edgeId },
            );
        }
    }

    let rootId: string | undefined = startNodeId;

    while (rootId) {
        inTree.add(rootId);
        record(
            treeCount === 0
            ? `Start at ${labelOf(rootId)}. Add it to the tree and queue its edges.`
            : `No edge leads out of the tree any more. Start a new tree at ${labelOf(rootId)}`,
            rootId,
        );
        treeCount++;
        queueEdgesFrom(rootId);


        while (!minHeap.isEmpty()) {
            const entry = minHeap.dequeue();
            if (!entry) break;

            const label = `${edgeLabel(entry.fromNodeId, entry.nodeId)} (${formatWeight(entry.weight)})`;
            const traversal: EdgeTraversal = { edgeId: entry.edgeId, fromNodeId: entry.fromNodeId };

            const { nodeId: cur, weight } = entry;
            if (inTree.has(cur)) {
                record(
                    `Skip ${label}: ${labelOf(cur)} is already in the tree, so this edge would form a cycle.`, 
                    null,
                    { traversal, skippedEdgeId: entry.edgeId},
                );
                continue;
            }

            inTree.add(cur);
            record(`Take the cheapest edge ${label} from the queue. Add ${labelOf(entry.nodeId)} to the tree.`,
                entry.nodeId,
                { traversal, activeEdgeId: entry.edgeId },
            );

            treeEdges.add(entry.edgeId);
            treeEdgeLabels.push(edgeLabel(entry.fromNodeId, cur));
            totalWeight += weight;
            queueEdgesFrom(entry.nodeId);
        }
        
        rootId = graph.nodes.find((node) => !inTree.has(node.id))?.id;
    }

    const kind = treeCount > 1 ? `Minimum Spanning Forest (${treeCount} trees)` : 'Minimum Spanning Tree';
    const edgeList = treeEdgeLabels.length > 0 ? treeEdgeLabels.join(', ') : 'no edges';
    record(`Prim's complete. The ${kind} has ${edgeList}. Total weight: ${formatWeight(totalWeight)}.`, null);
    
    return steps;
}