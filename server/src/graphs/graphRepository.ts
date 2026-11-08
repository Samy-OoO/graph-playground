import type { GraphInput, GraphSummary, UpdateResult, StoredGraph } from './types';

// Every method takes the owner's id, so there is no way to ask for "any graph", only "this user's graph".
// The methods are async even though SQLite is synchronous, so a different database later changes nothing for the callers.
export interface GraphRepository {
    list(ownerId: string): Promise<GraphSummary[]>; // Lists all graphs acc. to update date.
    
    get(ownerId: string, id: string): Promise<StoredGraph | null>; // This user's graph with this id, or null

    create(ownerId: string, input: GraphInput): Promise<StoredGraph>; // Stores a new graph. The server makes the id; the revision starts at 1.

    update(ownerId: string, id: string, input: GraphInput, expectedRevision: number): Promise<UpdateResult>; // Replaces the graph, but only if expectedRevision is still the stored revision.

    delete(ownerId: string, id: string): Promise<boolean>; // Removes the graph. Returns false if there was nothing to return.
}