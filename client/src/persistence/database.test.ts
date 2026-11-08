import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { createDocument } from './convert';
import { createDraft } from './draft';
import { IndexedDbDraftStore } from './indexedDbDraftStore';
import { IndexedDbRepository } from './indexedDbRepository';

describe('upgrading an existing version 1 database', () => {
  it('keeps the saved graphs and adds the drafts store', async () => {
    const name = 'upgrade-test-database';
    const doc = createDocument(
      { directed: true, weighted: false, nodes: [], edges: [] },
      'Saved before the upgrade',
      'd1',
      new Date('2026-10-31T09:00:00.000Z'),
    );

    // Build a database exactly as version 1 of the app would have left it: graphs only.
    const oldDatabase = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('graphs', { keyPath: 'id' });
      },
    });
    await oldDatabase.put('graphs', doc);
    oldDatabase.close();

    // Now open it the way the current app does.
    const repository = new IndexedDbRepository(name);
    expect(await repository.get('d1')).toEqual(doc);

    const drafts = new IndexedDbDraftStore(name);
    const draft = createDraft(doc, doc.updatedAt);
    await drafts.save(draft);
    expect(await drafts.get('d1')).toEqual(draft);
  });
});
