import type { Draft } from "./draft";
import type { DraftStore } from "./draftStore";

export class MemoryDraftStore implements DraftStore {
    private drafts = new Map<string, Draft>();

    async list(): Promise<Draft[]> {
        return [...this.drafts.values()]
            .map((draft) => structuredClone(draft))
            .sort((a, b) => b.draftedAt.localeCompare(a.draftedAt));
    }

    async get(documentId: string): Promise<Draft | null> {
        const draft = this.drafts.get(documentId);
        return draft ? structuredClone(draft) : null;
    }

    async save(draft: Draft): Promise<void> {
        this.drafts.set(draft.document.id, structuredClone(draft));
    }

    async delete(documentId: string): Promise<void> {
        this.drafts.delete(documentId);
    }
}