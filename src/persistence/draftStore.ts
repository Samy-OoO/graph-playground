import type { Draft } from './draft';

export interface DraftStore {
    // All drafts, most recently drafted one first.
    list(): Promise<Draft[]>;
    // The draft for this graph id, or null if there is none.
    get(documentId: string): Promise<Draft | null>;
    // Creates the draft, or replaces the one with the same graph id.
    save(draft: Draft): Promise<void>;
    // Removes the draft. Does nothing if it does not exist.
    delete(documentId: string): Promise<void>;
}