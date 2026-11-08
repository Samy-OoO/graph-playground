import type { GraphRepository, GraphSummary } from './repository';
import { toSummary } from './repository';
import type { GraphDocument } from './schema';
import { assertValidDocument } from './parse';

// Keeps graphs in memory only. Used by tests, and a handy stand-in before the real storage exists.
export class MemoryRepository implements GraphRepository {
    private documents = new Map<string, GraphDocument>();

    async list(): Promise<GraphSummary[]> {
        return [...this.documents.values()]
            .map(toSummary)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async get(id: string): Promise<GraphDocument | null> {
        const document = this.documents.get(id);
        return document ? structuredClone(document) : null;
    }

    async save(document: GraphDocument): Promise<void> {
        assertValidDocument(document);
        this.documents.set(document.id, structuredClone(document));
    }

    async delete(id: string): Promise<void> {
        this.documents.delete(id);
    }
}