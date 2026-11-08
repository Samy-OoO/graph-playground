import type { GraphData } from '../types/graph';
import { createId } from '../utils/id';
import { CURRENT_SCHEMA_VERSION, type GraphDocument } from './schema';

/**
 * Copies only the fields that belong in a saved file. Anything else on the editor state
 * (like the session-only `version` counter) is left behind on purpose.
 */
export function extractGraph(source: GraphData): GraphData {
    return {
        directed: source.directed,
        weighted: source.weighted,
        nodes: source.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, label: node.label })),
        edges: source.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            destination: edge.destination,
            ...(edge.weight !== undefined && { weight: edge.weight }),
        })),
    };
}

/** Wraps a graph in a brand-new document. */
export function createDocument(
    graph: GraphData,
    name: string,
    id: string = createId(),
    now: Date = new Date(),
): GraphDocument {
    const timestamp = now.toISOString();
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        graph: extractGraph(graph),
    };
}

/** Returns a copy of an existing document holding the latest graph. Id, name and createdAt stay put. */
export function updateDocument(document: GraphDocument, graph: GraphData, now: Date = new Date()): GraphDocument {
    return { ...document, graph: extractGraph(graph), updatedAt: now.toISOString() };
}

export function documentToGraph(document: GraphDocument): GraphData {
    return extractGraph(document.graph);
}