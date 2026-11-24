import type { GraphInput, SaveResult, StoredGraph } from './types';

// Every method takes the owner's id, so there is no way to ask for "any graph", only "this user's graph".
// The methods are async even though SQLite is synchronous, so a different database later changes nothing for the callers.
export interface GraphRepository {
    list(ownerId: string): Promise<StoredGraph[]>; // Lists all graphs acc. to update date.
    
    get(ownerId: string, id: string): Promise<StoredGraph | null>; // This user's graph with this id, or null

    save(ownerId: string, input: GraphInput, expectedRevision: number): Promise<SaveResult>; // Replaces the graph, but only if expectedRevision is still the stored revision.

    delete(ownerId: string, id: string): Promise<boolean>; // Removes the graph. Returns false if there was nothing to return.
}