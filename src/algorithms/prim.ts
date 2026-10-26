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

    // Like the `key_values` / `parents` arrays: the cheapest known edge into each node outside the tree.
    // Only these edges are shown as candidates, so the canvas never lights up every edge at once.
    const bestEdge = new Map<string, QueueEntry>();
    const minHeap = new MinPriorityQueue<QueueEntry>((entry) => entry.weight);
    
    function formatWeight(weight: number): string {
        return Number.isFinite(weight) ? String(Number(weight.toFixed(3))) : '∞';
    }

    const entryLabel = (entry: QueueEntry) => `${edgeLabel(entry.fromNodeId, entry.nodeId)} (${formatWeight(entry.weight)})`;

    function record(message: string, curNodeId: string | null, extras: {
        traversal?: EdgeTraversal;
        activeEdgeId?: string;
        skippedEdgeIds?: string[];
    } = {}) {
        const candidates = [...bestEdge.values()].sort((a, b) => a.weight - b.weight);

        const nodeStatus: Record<string, NodeStatus> = {};
        for (const entry of candidates) nodeStatus[entry.nodeId] = 'queued';
        for (const id of inTree) nodeStatus[id] = 'visited';
        if (curNodeId) nodeStatus[curNodeId] = 'current';

        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const id of treeEdges) edgeStatus[id] = 'settled';
        for (const entry of candidates) edgeStatus[entry.edgeId] = 'active';
        for (const id of extras.skippedEdgeIds ?? []) edgeStatus[id] = 'skipped';
        if (extras.activeEdgeId) edgeStatus[extras.activeEdgeId] = 'active';

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Cheapest edge to each node',
                kind: 'queue',
                items: candidates.map(entryLabel),
            },
        });
    }

    // Looks at the edges from a node that just joined the tree. For every neighbor outside the tree,
    // keep only the cheapest edge seen so far (a cheaper one replaces the old candidate).
    function updateCandidatesFrom(nodeId: string) {
        const added: string[] = [];
        const improved: string[] = [];
        const replacedEdgeIds: string[] = [];

        for (const nei of adjacency.get(nodeId) ?? []) {
            if (inTree.has(nei.nodeId)) continue;

            const weight = graph.weighted ? (nei.weight ?? 1) : 1;
            const old = bestEdge.get(nei.nodeId);
            if (old && weight >= old.weight) continue;

            const entry: QueueEntry = { nodeId: nei.nodeId, fromNodeId: nodeId, edgeId: nei.edgeId, weight };
            bestEdge.set(nei.nodeId, entry);
            minHeap.enqueue(entry);

            if (old) {
                improved.push(`${entryLabel(entry)} replaces ${entryLabel(old)}`);
                replacedEdgeIds.push(old.edgeId);
            } else {
                added.push(entryLabel(entry));
            }
        }

        if (added.length === 0 && improved.length === 0) return;

        const parts = [`Check the edges from ${labelOf(nodeId)}.`];
        if (added.length > 0) parts.push(`New candidates: ${added.join(', ')}.`);
        if (improved.length > 0) parts.push(`Cheaper edges found: ${improved.join(', ')}.`);
        record(parts.join(' '), nodeId, { skippedEdgeIds: replacedEdgeIds });
    }

    let rootId: string | undefined = startNodeId;

    while (rootId) {
        inTree.add(rootId);
        record(
            treeCount === 0
            ? `Start at ${labelOf(rootId)}. Add it to the tree.`
            : `No edge leads out of the tree any more. Start a new tree at ${labelOf(rootId)}`,
            rootId,
        );
        treeCount++;
        updateCandidatesFrom(rootId);


        while (!minHeap.isEmpty()) {
            const entry = minHeap.dequeue();
            if (!entry) break;

            // Ignore entries left behind after a cheaper edge replaced them (or their node joined the tree).
            if (inTree.has(entry.nodeId) || bestEdge.get(entry.nodeId) !== entry) continue;

            const traversal: EdgeTraversal = { edgeId: entry.edgeId, fromNodeId: entry.fromNodeId };
            const { nodeId: cur, weight } = entry;

            inTree.add(cur);
            bestEdge.delete(cur);
            record(`Take the cheapest edge ${entryLabel(entry)}. Add ${labelOf(cur)} to the tree.`,
                cur,
                { traversal, activeEdgeId: entry.edgeId },
            );

            treeEdges.add(entry.edgeId);
            treeEdgeLabels.push(edgeLabel(entry.fromNodeId, cur));
            totalWeight += weight;
            updateCandidatesFrom(cur);
        }
        
        rootId = graph.nodes.find((node) => !inTree.has(node.id))?.id;
    }

    const kind = treeCount > 1 ? `Minimum Spanning Forest (${treeCount} trees)` : 'Minimum Spanning Tree';
    const edgeList = treeEdgeLabels.length > 0 ? treeEdgeLabels.join(', ') : 'no edges';
    record(`Prim's complete. The ${kind} has ${edgeList}. Total weight: ${formatWeight(totalWeight)}.`, null);
    
    return steps;
}
