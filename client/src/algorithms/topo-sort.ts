import type { GraphData } from "../types/graph";
import { buildAdjacency, createLabelLookup } from "../utils/adjacency";
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from "./types";

/* Topological sort (Kahn's algorithm), recorded as animation frames. */
export function generateTopoSortSteps(graph: GraphData): AlgorithmStep[] {
    if (graph.nodes.length === 0) return [];

    if (!graph.directed) {
        return [{
            message: `Topological sort needs a directed graph. Turn on 'directed' to run it.`,
            nodeStatus: {},
            edgeStatus: {},
            traversal: null,
            structure: null,
        }];
    }
    
    const adjacency = buildAdjacency(graph);
    const labelOf = createLabelLookup(graph.nodes);
    const list = (nodeIds: string[]) => nodeIds.map((id) => labelOf(id)).join(', ');

    // In-degrees = how man edges point INTO a node.
    const inDegree = new Map(graph.nodes.map((node) => [node.id, 0]));
    for (const edge of graph.edges) {
        inDegree.set(edge.destination, inDegree.get(edge.destination)! + 1);
    }

    const steps: AlgorithmStep[] = [];
    const queue: string[] = [];
    const order: string[] = [];
    const removedEdges = new Set<string>();

    function record(
        message: string,
        curNodeId: string | null,
        extras: {
            traversal?: EdgeTraversal;
            activeEdgeId?: string;
            focus?: { nodeId: string; column: 0 | 1 }; // table cell to glow: 0 = in-degree, 1 = order
            blocked?: boolean; // mark every edge that was never removed
        } = {},
    ) {
        // Node status
        const nodeStatus: Record<string, NodeStatus> = {};
        for (const id of queue) nodeStatus[id] = 'queued';
        for (const id of order) nodeStatus[id] = 'visited';
        if (curNodeId) nodeStatus[curNodeId] = 'current';

        // Edge status
        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const id of removedEdges) edgeStatus[id] = 'settled';
        if (extras.blocked) {
            for (const edge of graph.edges) {
                if (!removedEdges.has(edge.id)) edgeStatus[edge.id] = 'skipped';
            }
        }
        if (extras.activeEdgeId) edgeStatus[extras.activeEdgeId] = 'active';
        
        const { focus } = extras;

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Ready queue',
                kind: 'queue',
                items: queue.map((id) => labelOf(id)),
                matrix: {
                    columnLabels: ['In-degree', 'Order'],
                    rows: graph.nodes.map((node) => {
                        const position = order.indexOf(node.id);
                        return {
                            label: labelOf(node.id),
                            cells: [String(inDegree.get(node.id)), position >= 0 ? String(position + 1) : '–'],
                        };
                    }),
                    focus: focus
                        ? { row: graph.nodes.findIndex((node) => node.id === focus.nodeId), column: focus.column, updated: true }
                        : undefined,
                },
            },
        });
    }

    record(`Count the edges pointing into each node: its in-degree. A node with in-degree 0 has no prerequisites.`, null);
    for (const node of graph.nodes) {
        if (inDegree.get(node.id) === 0) queue.push(node.id);
    }

    if (queue.length === 0) {
        record(
            `No node has in-degree 0, so every node is waiting on another one. That is a cycle. So, no topological order exists.`,
            null,
            { blocked: true },
        );
        return steps;
    }

    record(`Nodes with in-degree 0 are ready: ${list(queue)}. Add them to the queue.`, null);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        order.push(cur);
        record(`Take ${labelOf(cur)} from the queue. It goes at position ${order.length} of the order.`, cur, {
            focus: { nodeId: cur, column: 1 },
        });

        for (const { nodeId: nei, edgeId } of adjacency.get(cur) ?? []) {
            const before = inDegree.get(nei)!;
            const after = before - 1;
            inDegree.set(nei, after);
            removedEdges.add(edgeId);
            if (after === 0) queue.push(nei);

            record(
                `Remove edge ${labelOf(cur)} → ${labelOf(nei)}: ${labelOf(nei)}'s in-degree goes ${before} → ${after}.` + 
                (after === 0 ? ` ${labelOf(nei)} is ready, so add it to the queue.` : ''),
                cur,
                {
                    traversal: { edgeId, fromNodeId: cur },
                    activeEdgeId: edgeId,
                    focus: { nodeId: nei, column: 0 },
                },
            );
        }
    }

    if (order.length === graph.nodes.length) {
        record(`Done. Topological order: ${order.map((id) => labelOf(id)).join(' → ')}.`, null);
        return steps;
    }

    const stuck = graph.nodes.filter((node) => !order.includes(node.id)).map((node) => node.id);
    record(
        `The queue is empty, but only ${order.length} of ${graph.nodes.length} nodes were placed. ` + 
        `${list(stuck)} still wait on incoming edges that never go away, so they are on a cycle or blocked by one. ` + 
        `No topological order exists.`,
        null,
        { blocked: true },
    );

    return steps;
}