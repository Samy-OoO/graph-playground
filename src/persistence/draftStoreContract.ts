import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from './convert';
import { createDraft, type Draft } from './draft';
import type { DraftStore } from './draftStore';

function makeDraft(id: string, name: string, draftedAt: string): Draft {
    const document = createDocument(
        { directed: true, weighted: false, nodes: [{ id: 'a', x: 10, y: 10, label: 'A' }], edges: [] },
        name, 
        id, 
        new Date('2026-10-31T08:00:00.000Z'),
    );
    return createDraft(document, null, new Date(draftedAt));
}

// The tests every DraftStore must pass. Give it a function that creates a fresh, EMPTY store; it is called before every test.
export function describeDraftStoreContract(name: string, createStore: () => DraftStore | Promise<DraftStore>) {
  describe(`${name} (draft store contract)`, () => {
    let store: DraftStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('starts empty', async () => {
      expect(await store.list()).toEqual([]);
    });

    it('returns null when there is no draft for a graph', async () => {
      expect(await store.get('nope')).toBeNull();
    });

    it('gets back exactly what was saved', async () => {
      const draft = makeDraft('d1', 'First', '2026-10-31T09:00:00.000Z');
      await store.save(draft);
      expect(await store.get('d1')).toEqual(draft);
    });

    it('keeps only the latest draft for a graph', async () => {
      await store.save(makeDraft('d1', 'Earlier', '2026-10-31T09:00:00.000Z'));
      await store.save(makeDraft('d1', 'Later', '2026-10-31T09:05:00.000Z'));

      const drafts = await store.list();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].document.name).toBe('Later');
    });

    it('lists the most recently drafted first', async () => {
      await store.save(makeDraft('old', 'Old', '2026-10-31T09:00:00.000Z'));
      await store.save(makeDraft('new', 'New', '2026-10-31T11:00:00.000Z'));
      await store.save(makeDraft('mid', 'Mid', '2026-10-31T10:00:00.000Z'));

      const ids = (await store.list()).map((draft) => draft.document.id);
      expect(ids).toEqual(['new', 'mid', 'old']);
    });

    it('deletes a draft', async () => {
      await store.save(makeDraft('d1', 'First', '2026-10-31T09:00:00.000Z'));
      await store.delete('d1');
      expect(await store.get('d1')).toBeNull();
      expect(await store.list()).toEqual([]);
    });

    it('does nothing when deleting a draft that does not exist', async () => {
      await expect(store.delete('nope')).resolves.toBeUndefined();
    });

    it('is not affected by changes made to a draft after saving it', async () => {
      const draft = makeDraft('d1', 'First', '2026-10-31T09:00:00.000Z');
      await store.save(draft);
      draft.document.name = 'Changed afterwards';
      draft.document.graph.nodes.push({ id: 'b', x: 1, y: 1, label: 'B' });

      const stored = await store.get('d1');
      expect(stored?.document.name).toBe('First');
      expect(stored?.document.graph.nodes).toHaveLength(1);
    });

    it('is not affected by changes made to a draft it returned', async () => {
      await store.save(makeDraft('d1', 'First', '2026-10-31T09:00:00.000Z'));
      const first = await store.get('d1');
      if (first) first.document.name = 'Changed afterwards';

      const second = await store.get('d1');
      expect(second?.document.name).toBe('First');
    });
  });
}