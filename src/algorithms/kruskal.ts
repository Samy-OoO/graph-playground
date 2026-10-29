import type { GraphData } from "../types/graph";
import { createLabelLookup } from "../utils/adjacency";
import type { AlgorithmStep, EdgeStatus, EdgeTraversal, NodeStatus } from "./types";

// Union-Find (or Disjoint-Set Union): every node points toward the "leader" of its group.
class DSU{
    parent: number[];
    rank: number[];

    constructor(n: number) {
        this.parent = Array.from({ length: n }, (_, i) => i);
        this.rank = Array(n).fill(1);
    }

    find(x: number): number {
        if (x !== this.parent[x]) {
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }

    union(a: number, b: number): boolean {
        const rootA = this.find(a);
        const rootB = this.find(b);

        if (rootA === rootB) return false;
        if (this.rank[rootA] < this.rank[rootB]) this.parent[rootA] = rootB;
        else if (this.rank[rootA] > this.rank[rootB]) this.parent[rootB] = rootA;
        else {
            this.parent[rootB] = rootA;
            this.rank[rootA]++;
        }
        return true;
    }
}

type WeightedEdge = { edgeId: string; fromNodeId: string; toNodeId: string, weight: number };

export function generateKruskalSteps(graph: GraphData): AlgorithmStep[] {
    if (graph.nodes.length === 0) return [];

    // A spanning tree only makes sense for an undirected graph.
    if (graph.directed) {
        return [{
            message: `Kruskal's algorithm needs an undirected graph. Turn 'directed' off to run it.`,
            nodeStatus: {},
            edgeStatus: {},
            traversal: null,
            structure: null,
        }]
    }

    const labelOf = createLabelLookup(graph.nodes);
    const indexOf = new Map(graph.nodes.map((node, index) => [node.id, index]));

    // Format Helpers
    function formatWeight(weight: number) {
        return Number.isFinite(weight) ? String(Number(weight.toFixed(3))) : '∞';
    }
    const pair = (edge: WeightedEdge) => `${labelOf(edge.fromNodeId)} ↔ ${labelOf(edge.toNodeId)}`;
    const describe = (edge: WeightedEdge) => `${pair(edge)} (${formatWeight(edge.weight)})`;

    const sorted: WeightedEdge[] = graph.edges.map(
        (edge) => ({
            edgeId: edge.id,
            fromNodeId: edge.source,
            toNodeId: edge.destination,
            weight: graph.weighted ? (edge.weight ?? 1) : 1,
        })
    ).sort((a, b) => a.weight - b.weight);


    // How many edges does a full tree need?
    const countDSU = new DSU(graph.nodes.length);
    let componentCount = graph.nodes.length;
    for (const edge of sorted) {
        if (countDSU.union(indexOf.get(edge.fromNodeId)!, indexOf.get((edge.toNodeId))!)){
            componentCount--;
        }
    }
    const edgesNeeded = graph.nodes.length - componentCount;


    // Core Data Structures
    const steps: AlgorithmStep[] = [];
    const queue = [...sorted];
    const accepted: WeightedEdge[] = [];
    const acceptedIds = new Set<string>();
    let totalWeight = 0;
    const dsu = new DSU(graph.nodes.length);
    
    const groupOf = (node: number) => labelOf(graph.nodes[dsu.find(node)].id);

    // Step recorder
    function record(
        message: string,
        extras: {
            current?: WeightedEdge,
            traversal?: EdgeTraversal,
            activeEdgeId?: string,
            skippedEdgeId?: string,
            done?: boolean,
        } = {}
    ) {
        // Node Status
        const nodeStatus: Record<string, NodeStatus> = {};
        for (const edge of accepted) {
            nodeStatus[edge.fromNodeId] = 'visited';
            nodeStatus[edge.toNodeId] = 'visited';
        }
        if (extras.done) {
            for (const node of graph.nodes) nodeStatus[node.id] = 'visited';
        }
        if (extras.current) {
            nodeStatus[extras.current.fromNodeId] = 'current';
            nodeStatus[extras.current.toNodeId] = 'current';
        }

        // Edge Status
        const edgeStatus: Record<string, EdgeStatus> = {};
        for (const id of acceptedIds) edgeStatus[id] = 'settled';
        if (extras.activeEdgeId) edgeStatus[extras.activeEdgeId] = 'active';
        if (extras.skippedEdgeId) edgeStatus[extras.skippedEdgeId] = 'skipped';

        steps.push({
            message,
            nodeStatus,
            edgeStatus,
            traversal: extras.traversal ?? null,
            structure: {
                title: 'Edges, lightest first',
                kind: 'queue',
                items: queue.map(describe),
                matrix: { // Optional: For a tabular display of each vertex's group
                    columnLabels: ['Group'],
                    rows: graph.nodes.map((node, index) => ({
                        label: labelOf(node.id),
                        cells: [groupOf(index)],
                    })),
                },
            }
        });
    }

    record(
        sorted.length === 0
        ? 'The graph has no edges, so every node is its own tree'
        : `Sort all ${sorted.length} edge${sorted.length === 1 ? '' : 's'} from lightest to heaviest. Every node starts in a group of its own.`,
    );


    // Kruskal's algo:
    while (queue.length > 0) {
        if (accepted.length === edgesNeeded) {
            record(
                `${accepted.length} edge${accepted.length === 1 ? ' is' : 's are'} enough to connect everything that has to be connected. ` + 
                `The remaining ${queue.length} edge${queue.length === 1 ? '' : 's'} could only form cycles. So, stop early.`
            );
            break;
        }

        const edge = queue.shift()!;
        const from = indexOf.get(edge.fromNodeId)!;
        const to = indexOf.get(edge.toNodeId)!;
        const traversal: EdgeTraversal = { edgeId: edge.edgeId, fromNodeId: edge.fromNodeId }
        const fromGroup = groupOf(from);
        const toGroup = groupOf(to);

        if (dsu.union(from, to)) {
            accepted.push(edge);
            acceptedIds.add(edge.edgeId);
            totalWeight += edge.weight;
            record(
                `Add ${describe(edge)}: ${labelOf(edge.fromNodeId)} is in group ${fromGroup} and ${labelOf(edge.toNodeId)} is in group ${toGroup}. ` + 
                `Different groups, so no cycle. Merge them into group ${groupOf(from)}`,
                { current: edge, activeEdgeId: edge.edgeId, traversal },
            );
        } else {
            record(
                `Skip ${describe(edge)}: ${labelOf(edge.fromNodeId)} and ${labelOf(edge.toNodeId)} are already both in group ${fromGroup}, so this edge would form a cycle.`,
                { current: edge, skippedEdgeId: edge.edgeId, traversal }
            )
        }
    }

    const treeCount = graph.nodes.length - accepted.length;
    const kind = treeCount > 1 ? `Minimum Spanning Forest (${treeCount} trees)` : 'Minimum Spanning Tree';
    const edgeList = accepted.length > 0 ? accepted.map(pair).join(', ') : 'no edges';

    record(`Kruskal's complete. The ${kind} has ${edgeList}. Total weight: ${formatWeight(totalWeight)}.`, { done: true });

    
    return steps;
}