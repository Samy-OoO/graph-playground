import type { GraphRepository, GraphSummary } from './repository';
import { toSummary } from './repository';
import type { GraphDocument } from '@graph-playground/shared';
import { assertValidDocument, parseDocumentData } from '@graph-playground/shared';
import { GRAPHS_STORE, openGraphDB, type GraphDBConnection } from './database';

export class IndexedDbRepository implements GraphRepository {
    private database: Promise<GraphDBConnection>;

    constructor(dbName?: string) {
        this.database = openGraphDB(dbName);
    }

    async list(): Promise<GraphSummary[]> {
        const db = await this.database;
        const records = await db.getAll(GRAPHS_STORE);

        const summaries: GraphSummary[] = [];
        for (const record of records) {
            const parsed = parseDocumentData(record);
            if (parsed.ok) {
                summaries.push(toSummary(parsed.document));
            } else {
                console.warn(`Skipping a saved graph that could not be read.`, parsed.errors);
            }
        }
        return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async get(id: string): Promise<GraphDocument | null> {
        const db = await this.database;
        const record = await db.get(GRAPHS_STORE, id);
        if (record === undefined) return null;

        const parsed = parseDocumentData(record);
        if (!parsed.ok) {
            throw new Error(`The saved graph "${id}" could not be read: ${parsed.errors.join(';')}`);
        }
        return parsed.document;
    }

    async save(document: GraphDocument): Promise<void> {
        assertValidDocument(document);
        const db = await this.database;
        await db.put(GRAPHS_STORE, document);
    }

    async delete(id: string): Promise<void> {
        const db = await this.database;
        await db.delete(GRAPHS_STORE, id);
    }
}