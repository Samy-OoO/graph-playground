import type { GraphData } from "../types/graph";
import { createLabelLookup } from "../utils/adjacency";
import type { AlgorithmStep, EdgeStatus, NodeStatus } from "./types";

/** What to highlight in one frame. Nodes and the table cell are given as indexes into graph.nodes. */
type Focus = {
  pivot?: number; // k: the node we are allowed to route through
  row?: number; // i: where the path starts
  column?: number; // j: where the path ends
  updated?: boolean; // did dist[i][j] just improve?
  routeEdgeIds?: string[]; // edges of the new shortest route i -> j
  done?: boolean;
};

export function generateFloydWarshallSteps(graph: GraphData): AlgorithmStep[] {
    
    const nodes = graph.nodes;
    const count = nodes.length;
    if (count === 0) return [];

    const labelOf = createLabelLookup(graph.nodes);
    const label = (index: number) => labelOf(nodes[index].id);
    const indexOf = new Map(nodes.map((node, index) => [node.id, index]));

    // distances[i][j] = best known distance from i to j.
    const distances = nodes.map((_, i) => nodes.map((_, j) => (i === j ? 0 : Infinity)));
    const routes: number[][][] = nodes.map((_, i) => nodes.map((_, j) => (i === j ? [i] : [])));
    const edgeBetween: (string | undefined)[][] = nodes.map(() => nodes.map(() => undefined));
    
    function addDirectEdge(i: number, j: number, edgeId: string, weight: number){
        if (weight >= distances[i][j]) return;
        distances[i][j] = weight;
        routes[i][j] = [i, j];
        edgeBetween[i][j] = edgeId;
    }

    for (const edge of graph.edges) {
        const from = indexOf.get(edge.source)!;
        const to = indexOf.get(edge.destination)!;
        const weight = graph.weighted ? (edge.weight ?? 1) : 1;
        addDirectEdge(from, to, edge.id, weight);
        if (!graph.directed) addDirectEdge(to, from, edge.id, weight);
    }

    const steps: AlgorithmStep[] = [];

    function formatNumber(value: number) {
        return Number.isFinite(value) ? String(Number(value.toFixed(3))) : '∞';
    }

    const bracketed = (value: number) => (value < 0 ? `(${formatNumber(value)})` : formatNumber(value));

    function record(message: string, focus: Focus = {}) {
        // Recording node status
        const nodeStatus: Record<string, NodeStatus> = {};
        if (focus.done) {
            for (const node of nodes) nodeStatus[node.id] = 'visited';
        } else {
            if (focus.row !== undefined) nodeStatus[nodes[focus.row].id] = 'queued';
            if (focus.column !== undefined) nodeStatus[nodes[focus.column].id] = 'queued';
            if (focus.pivot !== undefined) nodeStatus[nodes[focus.pivot].id] = 'current';
        }  

        // Recording edge status
        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const edgeId of focus.routeEdgeIds ?? []) edgeStatus[edgeId] = 'active';

        steps.push({
            message, 
            nodeStatus, 
            edgeStatus, 
            traversal: null,
            structure: {
                title: "Shortest distances (row → column)",
                kind: 'matrix',
                items: [],
                matrix: {
                    columnLabels: nodes.map((node) => labelOf(node.id)),
                    rows: nodes.map((node, i) => ({
                        label: labelOf(node.id),
                        cells: distances[i].map(formatNumber),
                    })),
                    pivot: focus.pivot,
                    focus: focus.row !== undefined && focus.column !== undefined
                            ? {row: focus.row, column: focus.column, updated: focus.updated ?? false }
                            : undefined,
                },
            },
        });
    }


    // The edges along the route i -> j, found by pairing up neighboring nodes in the route
    function edgesOfRoute(i: number, j: number): string[] {
        const route = routes[i][j];
        const ids: string[] = [];
        for (let step = 0; step + 1 < route.length; step++) {
            const edgeId = edgeBetween[route[step]][route[step + 1]];
            if (edgeId) ids.push(edgeId);
        }
        return ids;
    }

    
    record('Start with the direct edges. A node is 0 away from itself; pairs with no direct edges are ∞.');

    for (let k = 0; k < count; k++) {
        record(
            `Record ${k + 1} of ${count}: allow paths that go through ${label(k)}.` + 
            `Pairs that cannot get to ${label(k)} (or cannot leave it) are skipped.`,
            { pivot: k },
        );

        for (let i = 0; i < count; i++) {
            if (i === k || !Number.isFinite(distances[i][k])) continue;

            for (let j = 0; j < count; j++) {
                if (j === k || !Number.isFinite(distances[k][j])) continue;
                
                const through = distances[i][k] + distances[k][j];
                const cur = distances[i][j];
                const sum = `${formatNumber(distances[i][k])} + ${bracketed(distances[k][j])} = ${formatNumber(through)}`;

                // Going i -> k -> i for less than nothing means looping around makes things cheaper forever.
                if (i === j) {
                    if (through < 0) {
                        distances[i][i] = through;
                        record(
                            `${label(i)} → ${label(k)} → ${label(i)}: ${sum}, which is below 0. ` + 
                            `That is a negative cycle through ${label(i)} and ${label(k)}, so shortest paths are not defined.`,
                            { pivot: k, row: i, column: i, updated: true },
                        );
                        return steps;
                    }
                    continue;
                }

                if (through < cur) {
                    distances[i][j] = through;
                    routes[i][j] = [...routes[i][k], ...routes[k][j].slice(1)];
                    record(
                        `Update ${label(i)} → ${label(j)} via ${label(k)}: ${sum} beats ${formatNumber(cur)}.`,
                        { pivot: k, row: i, column: j, updated: true, routeEdgeIds: edgesOfRoute(i, j) },
                    );
                }
                else {
                    record(
                        `${label(i)} → ${label(j)} via ${label(k)}: ${sum} is not better than ${formatNumber(cur)}. Keep it.`,
                        { pivot: k, row: i, column: j },
                    );
                }
            }
        }
    }

    let unreachablePairs = 0;
    for (let i = 0; i < count; i++) {
        for (let j = 0; j < count; j++) {
            if (!Number.isFinite(distances[i][j])) unreachablePairs++;
        }    
    }

    const note = unreachablePairs > 0
        ? ` ${unreachablePairs} pair${unreachablePairs === 1 ? ' has' : 's have'} no path (∞).`
        : '';
    record(`Floyd-Warshall complete. Read the table as: row = from, column = to.${note}`, { done: true });
    return steps;
}