import type { GraphDocument } from './schema';

// What the "My graphs" list needs to show a graph, without carrying the whole graph.
export type GraphSummary = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    nodeCount: number;
    edgeCount: number;
};

export interface GraphRepository {
    // Summaries of all saved graphs, most recently updated first.
    list(): Promise<GraphSummary[]>;
    // The saved graph with this id, or null if there is none.
    get(id: string): Promise<GraphDocument | null>;
    // Creates the graph, or replaces the one with the same id.
    save(document: GraphDocument): Promise<void>;
    // Removes the graph. Does nothing if it does not exist.
    delete(id: string): Promise<void>;
}

export function toSummary(document: GraphDocument): GraphSummary {
    return {
        id: document.id,
        name: document.name,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        nodeCount: document.graph.nodes.length,
        edgeCount: document.graph.edges.length,
    };
}