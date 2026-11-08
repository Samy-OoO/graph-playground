import type { GraphDocument } from '@graph-playground/shared';

// Just nodes & edges (& the directed and weighted flags).
export type Graph = GraphDocument['graph'];

// What a client sends when it creates or saves a graph. The server fills in everything else.
export type GraphInput = {
    name: string;
    graph: Graph;
};


// A graph exactly as the server remembers it.
export type StoredGraph = {
    id: string;
    name: string;
    graph: Graph;
    schemaVersion: number;
    revision: number;
    createdAt: string;
    updatedAt: string;
};


// What a "My graphs" list needs, without carrying every node and edge.
export type GraphSummary = {
    id: string;
    name: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
    nodeCount: number;
    edgeCount: number;
};


// Saving can succeed or fail in 2 diff. ways. The caller has to handle each one.
export type UpdateResult = 
    | { ok: true; graph: StoredGraph }
    | { ok: false; reason: 'not_found' }
    | { ok: false; reason: 'conflict'; current: StoredGraph };