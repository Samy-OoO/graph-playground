import { DRAFTS_STORE, openGraphDB, type GraphDBConnection } from './database';
import { assertValidDraft, draftSchema, type Draft } from './draft';
import type { DraftStore } from './draftStore';


// Returns the draft if the stored record is valid, or null (with a console warning) if it is not.
function readDraft(record: unknown): Draft | null {
    const parsed = draftSchema.safeParse(record);
    if (parsed.success) return parsed.data;
    console.warn('Ignoring a saved draft that could not be read.', parsed.error.issues);
    return null;
}

// Saves drfts in the browser's IndexedDB, next to the saved graphs.
export class IndexedDbDraftStore implements DraftStore {
    private database: Promise<GraphDBConnection>;

    constructor(dbName?: string) {
        this.database = openGraphDB(dbName);
    }

    async list(): Promise<Draft[]> {
        const db = await this.database;
        const records = await db.getAll(DRAFTS_STORE);

        const drafts: Draft[] = [];
        for (const record of records) {
            const draft = readDraft(record);
            if (draft) drafts.push(draft);
        }
        return drafts.sort((a, b) => b.draftedAt.localeCompare(a.draftedAt));
    }

    async get(documentId: string): Promise<Draft | null> {
        const db = await this.database;
        const record = await db.get(DRAFTS_STORE, documentId);
        return record === undefined ? null : readDraft(record);
    }

    async save(draft: Draft): Promise<void> {
        assertValidDraft(draft);
        const db = await this.database;
        await db.put(DRAFTS_STORE, draft);
    }

    async delete(documentId: string): Promise<void> {
        const db = await this.database;
        await db.delete(DRAFTS_STORE, documentId);
    }

}