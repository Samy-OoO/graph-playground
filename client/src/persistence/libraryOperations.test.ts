import { describe, expect, it } from 'vitest';
import { createDocument, updateDocument } from './convert';
import { createDraft } from './draft';
import { deleteGraph, duplicateGraph, renameGraph } from './libraryOperations';
import { LIMITS } from './limits';
import { MemoryDraftStore } from './memoryDraftStore';
import { MemoryRepository } from './memoryRepository';
import { copyName, DEFAULT_GRAPH_NAME } from './session';
import { openGraph } from './sessionOperations';

const nineAm = new Date('2026-10-31T09:00:00.000Z');
const tenAm = new Date('2026-10-31T10:00:00.000Z');
const elevenAm = new Date('2026-10-31T11:00:00.000Z');

const twoNodes = {
  directed: true,
  weighted: false,
  nodes: [
    { id: 'a', x: 10, y: 10, label: 'A' },
    { id: 'b', x: 50, y: 50, label: 'B' },
  ],
  edges: [{ id: 'e1', source: 'a', destination: 'b' }],
};
const movedNodes = { ...twoNodes, nodes: [{ ...twoNodes.nodes[0], x: 99 }, twoNodes.nodes[1]] };

function freshStores() {
  return { repository: new MemoryRepository(), drafts: new MemoryDraftStore() };
}

async function storeSaved(stores: ReturnType<typeof freshStores>, id = 'd1', name = 'My graph') {
  const saved = createDocument(twoNodes, name, id, nineAm);
  await stores.repository.save(saved);
  return saved;
}

describe('copyName', () => {
  it('adds (copy) to the name', () => {
    expect(copyName('Graph')).toBe('Graph (copy)');
  });

  it('shortens a very long name so the result still fits the limit', () => {
    const result = copyName('x'.repeat(LIMITS.maxNameLength));
    expect(result).toHaveLength(LIMITS.maxNameLength);
    expect(result.endsWith(' (copy)')).toBe(true);
  });

  it('copes with an empty name', () => {
    expect(copyName('  ')).toBe(`${DEFAULT_GRAPH_NAME} (copy)`);
  });
});

describe('duplicateGraph', () => {
  it('saves a new graph with the same content and a copy name', async () => {
    const stores = freshStores();
    await storeSaved(stores);

    const copy = await duplicateGraph(stores, 'd1', tenAm, 'd2');

    expect(copy).toMatchObject({ id: 'd2', name: 'My graph (copy)' });
    expect(copy.createdAt).toBe('2026-10-31T10:00:00.000Z');
    expect(copy.graph).toEqual(twoNodes);
    expect(await stores.repository.get('d2')).toEqual(copy);
  });

  it('leaves the original untouched and does not copy unsaved changes', async () => {
    const stores = freshStores();
    const original = await storeSaved(stores);
    await stores.drafts.save(createDraft(updateDocument(original, movedNodes, tenAm), original.updatedAt));

    const copy = await duplicateGraph(stores, 'd1', elevenAm, 'd2');

    expect(copy.graph.nodes[0].x).toBe(10);
    expect(await stores.repository.get('d1')).toEqual(original);
    expect(await stores.drafts.get('d2')).toBeNull();
  });

  it('throws when the graph does not exist', async () => {
    await expect(duplicateGraph(freshStores(), 'nope')).rejects.toThrow(/no saved graph/);
  });
});

describe('renameGraph', () => {
  it('changes the name and updatedAt but nothing else', async () => {
    const stores = freshStores();
    const original = await storeSaved(stores);

    const renamed = await renameGraph(stores, 'd1', '  Better name ', tenAm);

    expect(renamed).toEqual({ ...original, name: 'Better name', updatedAt: '2026-10-31T10:00:00.000Z' });
    expect(await stores.repository.get('d1')).toEqual(renamed);
  });

  it('does nothing when the name is the same', async () => {
    const stores = freshStores();
    const original = await storeSaved(stores);

    const result = await renameGraph(stores, 'd1', 'My graph ', tenAm);

    expect(result).toEqual(original);
    expect((await stores.repository.get('d1'))?.updatedAt).toBe(original.updatedAt);
  });

  it('turns a blank name into the default name', async () => {
    const stores = freshStores();
    await storeSaved(stores);
    const renamed = await renameGraph(stores, 'd1', '   ', tenAm);
    expect(renamed.name).toBe(DEFAULT_GRAPH_NAME);
  });

  it('throws when the graph does not exist', async () => {
    await expect(renameGraph(freshStores(), 'nope', 'x')).rejects.toThrow(/no saved graph/);
  });

  it('does not turn a leftover draft into a conflict', async () => {
    const stores = freshStores();
    const original = await storeSaved(stores);
    await stores.drafts.save(createDraft(updateDocument(original, movedNodes, tenAm), original.updatedAt));

    await renameGraph(stores, 'd1', 'Renamed', elevenAm);

    const result = await openGraph(stores, 'd1');
    expect(result.pending?.verdict).toBe('restore');
    expect(result.pending?.draft.document.name).toBe('Renamed');
  });
});

describe('deleteGraph', () => {
  it('removes the graph and its draft', async () => {
    const stores = freshStores();
    const saved = await storeSaved(stores);
    await stores.drafts.save(createDraft(saved, saved.updatedAt));

    await deleteGraph(stores, 'd1');

    expect(await stores.repository.get('d1')).toBeNull();
    expect(await stores.drafts.get('d1')).toBeNull();
  });

  it('does nothing for a graph that does not exist', async () => {
    await expect(deleteGraph(freshStores(), 'nope')).resolves.toBeUndefined();
  });

  it('leaves the graph in place if deleting it fails', async () => {
    const stores = freshStores();
    await storeSaved(stores);
    stores.repository.delete = async () => {
      throw new Error('could not delete');
    };

    await expect(deleteGraph(stores, 'd1')).rejects.toThrow('could not delete');
    expect(await stores.repository.get('d1')).not.toBeNull();
  });
});