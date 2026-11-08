import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';
import { createDocument } from './convert';
import { IndexedDbRepository } from './indexedDbRepository';
import { describeRepositoryContract } from './repositoryContract';

let counter = 0;
function freshDatabaseName(): string {
  counter += 1;
  return `test-database-${counter}`;
}

describeRepositoryContract('IndexedDbRepository', () => new IndexedDbRepository(freshDatabaseName()));

describe('IndexedDbRepository specifics', () => {
  const doc = createDocument(
    { directed: true, weighted: false, nodes: [], edges: [] },
    'Persisted',
    'd1',
    new Date('2026-10-31T09:00:00.000Z'),
  );

  it('keeps graphs when the repository is created again (like a page refresh)', async () => {
    const name = freshDatabaseName();
    await new IndexedDbRepository(name).save(doc);

    const afterRefresh = new IndexedDbRepository(name);
    expect(await afterRefresh.get('d1')).toEqual(doc);
  });

  it('refuses to hand out a stored record that is damaged', async () => {
    const name = freshDatabaseName();
    const repository = new IndexedDbRepository(name);
    await repository.list(); // makes sure the database and its store exist

    const raw = await openDB(name);
    await raw.put('graphs', { id: 'broken', schemaVersion: 1, name: 'Broken' });
    raw.close();

    await expect(repository.get('broken')).rejects.toThrow(/could not be read/);
  });

  it('skips damaged records when listing, but still lists the good ones', async () => {
    const name = freshDatabaseName();
    const repository = new IndexedDbRepository(name);
    await repository.save(doc);

    const raw = await openDB(name);
    await raw.put('graphs', { id: 'broken', schemaVersion: 1, name: 'Broken' });
    raw.close();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const summaries = await repository.list();
    warn.mockRestore();

    expect(summaries.map((summary) => summary.id)).toEqual(['d1']);
  });
});