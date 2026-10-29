import type { GraphData } from "../types/graph";
import { buildAdjacency, createLabelLookup } from "../utils/adjacency";
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from "./types";

export function generateEulerSteps(graph: GraphData): AlgorithmStep[] {
    if (graph.nodes.length === 0) return [];

    if (graph.nodes.length === 0) {
        return [{
            message: 'The graph has no edges, so there is nothing to walk.',
            nodeStatus: {},
            edgeStatus: {},
            traversal: null,
            structure: null,
        }];
    }

    const adjacency = buildAdjacency(graph);
    const labelOf = createLabelLookup(graph.nodes);
    const list = (nodeIds: string[]) => nodeIds.map((id) => labelOf(id)).join(', ');

    // Count edges going into and out of the node.
    const inDegree = new Map(graph.nodes.map((node) => [node.id, 0]));
    const outDegree = new Map(graph.nodes.map((node) => [node.id, 0]));
    for (const edge of graph.edges) {
        inDegree.set(edge.destination, inDegree.get(edge.destination)! + 1);
        outDegree.set(edge.source, outDegree.get(edge.source)! + 1);
    }

    const degreeOf = (id: string) => inDegree.get(id)! + outDegree.get(id)!;

    const unused = new Map(graph.nodes.map((node) => [node.id, graph.directed ? outDegree.get(node.id) : degreeOf(node.id)]),);

    // Nodes that break the "perfect" rule: odd degree (undirected) or in != out (directed).
    const uneven = graph.nodes.filter(
        (node) => graph.directed? inDegree.get(node.id) !== outDegree.get(node.id) : degreeOf(node.id) % 2 !== 0
    ).map((node) => node.id);

    // Decide where the walk must start (and end, for a path that is not a circuit).
    let startId: string | undefined;
    let endId: string | undefined;

    if (uneven.length === 0) {
        startId = graph.nodes.find((node) => degreeOf(node.id) > 0)!.id;
    } else if (graph.directed) {
        const starts = uneven.filter((id) => outDegree.get(id)! - inDegree.get(id)! === 1);
        const ends = uneven.filter((id) => inDegree.get(id)! - outDegree.get(id)! === 1);
        if (uneven.length === 2 && starts.length === 1 && ends.length === 1) {
            startId = starts[0];
            endId = ends[0];
        }
    } else if (uneven.length === 2) {
        [startId, endId] = uneven;
    }

    const columnLabels = graph.directed ? ['In', 'Out', 'Unused'] : ['Degree', 'Unused'];

    const steps: AlgorithmStep[] = [];
    const stack: string[] = [];
    const output: string[] = [];
    const usedEdges = new Set<string>();

    function record(
        message: string,
        extras: {
            currentId?: string; // defaults to the top of the stack
            queuedIds?: string[];
            traversal?: EdgeTraversal;
            activeEdgeId?: string;
            focusNodeId?: string; // whose "Unused" cell glows
            blocked?: boolean; // mark every edge that was never walked
        } = {},
    ) {
        // Node Status
        const nodeStatus: Record<string, NodeStatus> = {};
        for (const id of output) nodeStatus[id] = 'visited';
        for (const id of stack) nodeStatus[id] = 'onPath';
        for (const id of extras.queuedIds ?? []) nodeStatus[id] = 'queued';
        const currentId = extras.currentId ?? stack[stack.length - 1];
        if (currentId) nodeStatus[currentId] = 'current';

        //Edge Status
        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const id of usedEdges) edgeStatus[id] = 'settled';
        if (extras.blocked) {
            for (const edge of graph.edges) {
                if (!usedEdges.has(edge.id)) edgeStatus[edge.id] = 'skipped';
            }
        }
        if (extras.activeEdgeId) edgeStatus[extras.activeEdgeId] = 'active';

        const { focusNodeId } = extras;

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Walk stack',
                kind: 'stack',
                items: stack.map((id) => labelOf(id)),
                matrix: {
                    columnLabels,
                    rows: graph.nodes.map((node) => ({
                        label: labelOf(node.id),
                        cells: graph.directed 
                            ? [String(inDegree.get(node.id)), String(outDegree.get(node.id)), String(unused.get(node.id))]
                            : [String(degreeOf(node.id)), String(unused.get(node.id))],
                    })),
                    focus: focusNodeId
                        ? {
                            row: graph.nodes.findIndex((node) => node.id === focusNodeId),
                            column: columnLabels.length - 1,
                            updated: true,
                        }
                        : undefined,
                },
            },
        });
    }

    // Frame 1: the degree counts, with the troublemakers highlighted.
    record(
        graph.directed
        ? `Count each node's in-degree and out-degree. ${uneven.length > 0 ? `Unbalanced nodes (in ≠ out): ${list(uneven)}.` : `Every node is balanced (in = out).`}`
        : `Count each node's degree (how many edges touch it). ${uneven.length > 0 ? `Odd-degree nodes: ${list(uneven)}` : `Every node has an even degree.`}`,
        { queuedIds: uneven },
    );

    // Frame 2: the verdict. Stop here if the degrees already rule an Euler walk out.
    if (!startId) {
        record(
            graph.directed
            ? `${list(uneven)} do not fit. An Eulerian path needs every node balanced (in = out), or exactly one node with out − in = 1 (the start) and one with in − out = 1 (the end). None exists.`
            : `${uneven.length} nodes have odd degree (${list(uneven)}). A walk that uses every edge once needs 0 or 2 of them, so none exists.`,
            { queuedIds: uneven },
        );
        return steps;
    }

    record(
        endId
        ? `Exactly two nodes break the rule (${list(uneven)}), so a Eulerian path exists. It must start at ${labelOf(startId)} and end at ${labelOf(endId)}.`
        : `${graph.directed ? 'Every node is balanced' : 'Every node has an even degree'}, so a Eulerian circuit exists: a walk that ends where it started. Start at ${labelOf(startId)}.`,
        { currentId: startId, queuedIds: endId ? [endId] : [] },
    );


    // Heirholzer's algo to find Eulerian path/circuit.
    stack.push(startId);
    record(`Push ${labelOf(startId)} on the stack and begin the walk.`);

    while (stack.length > 0) {
        const top = stack[stack.length - 1];
        const edge = (adjacency.get(top) ?? []).find((nei) => !usedEdges.has(nei.edgeId));

        if (edge) {
            usedEdges.add(edge.edgeId);
            unused.set(top, unused.get(top)! - 1);
            if (!graph.directed) unused.set(edge.nodeId, unused.get(edge.nodeId)! - 1);
            stack.push(edge.nodeId);

            record(
                `Walk ${labelOf(top)} → ${labelOf(edge.nodeId)} and mark the edge as used.`, 
                {
                    traversal: { edgeId: edge.edgeId, fromNodeId: top },
                    activeEdgeId: edge.edgeId,
                    focusNodeId: top,
                }
            );
        } 
        else {
            stack.pop();
            output.push(top);

            record(
                `${labelOf(top)} has no unused edges left. So, pop it into the output. The path is built backwards: ${list(output)}.`,
                { focusNodeId: top },
            );
        }
    }

    const kind = endId ? 'path' : 'circuit';
    if (usedEdges.size < graph.edges.length) {
        record(
            `Only ${usedEdges.size} of ${graph.edges.length} edges can be reached from ${labelOf(startId)}, so the rest sit in a separate part of the graph. No Eulerian ${kind} exists.`,
            { blocked: true },
        );
        return steps;
    }

    const path = [...output].reverse().map((id) => labelOf(id)).join(' → ');
    record(
        `Eulerian ${kind}: ${path}.${endId ? '' : 'It ends where it started.'}`,
        { currentId: startId, queuedIds: endId ? [endId] : [] },
    );

    return steps;
}