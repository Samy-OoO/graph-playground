import type { GraphDocument } from '@graph-playground/shared';

// Just nodes & edges (& the directed and weighted flags).
export type Graph = GraphDocument['graph'];

// What a client sends when it creates or saves a graph. The server fills in everything else.
export type GraphInput = {
    id: string;
    name: string;
    graph: Graph;
    createdAt: string;
    updatedAt: string;
};


// A graph exactly as the server remembers it.
export type StoredGraph = GraphInput & {
    schemaVersion: number;
    revision: number;
};

// Saving can succeed or fail in 2 diff. ways. The caller has to handle each one.
export type SaveResult = 
    | { ok: true; graph: StoredGraph }
    | { ok: false; reason: 'not_found' }
    | { ok: false; reason: 'conflict'; current: StoredGraph };