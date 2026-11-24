import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';
import { createDocument } from './convert';
import { createDraft } from './draft';
import { describeDraftStoreContract } from './draftStoreContract';
import { IndexedDbDraftStore } from './indexedDbDraftStore';

let counter = 0;
function freshDatabaseName(): string {
  counter += 1;
  return `draft-test-database-${counter}`;
}

describeDraftStoreContract('IndexedDbDraftStore', () => new IndexedDbDraftStore(freshDatabaseName()));

describe('IndexedDbDraftStore specifics', () => {
  const doc = createDocument(
    { directed: true, weighted: false, nodes: [], edges: [] },
    'Unsaved work',
    'd1',
    new Date('2026-10-31T09:00:00.000Z'),
  );
  const draft = createDraft(doc, null, new Date('2026-10-31T09:30:00.000Z'));

  it('keeps drafts when the store is created again (like a page refresh)', async () => {
    const name = freshDatabaseName();
    await new IndexedDbDraftStore(name).save(draft);

    const afterRefresh = new IndexedDbDraftStore(name);
    expect(await afterRefresh.get('d1')).toEqual(draft);
  });

  it('treats a damaged draft as if there were none', async () => {
    const name = freshDatabaseName();
    const store = new IndexedDbDraftStore(name);
    await store.list(); // makes sure the database and its stores exist

    const raw = await openDB(name);
    await raw.put('drafts', { document: { id: 'broken' }, basedOn: null });
    raw.close();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await store.get('broken')).toBeNull();
    expect(await store.list()).toEqual([]);
    warn.mockRestore();
  });
});