import { describe, expect, it, vi } from 'vitest';
import { createDocument, updateDocument } from './convert';
import { createDraft } from './draft';
import { MemoryDraftStore } from './memoryDraftStore';
import { MemoryRepository } from './memoryRepository';
import { DEFAULT_GRAPH_NAME } from './session';
import {
  applyDraft,
  autosaveDraft,
  buildDocument,
  findRecoverableDrafts,
  openedFromDocument,
  openedFromImport,
  openGraph,
  recoverFromDraft,
  revertGraph,
  saveGraph,
  saveGraphAs,
  startNewGraph,
} from './sessionOperations';

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

describe('startNewGraph', () => {
  it('gives a blank, never-saved graph with the default name', () => {
    const { info, graph } = startNewGraph('new1', nineAm);
    expect(info).toEqual({ id: 'new1', name: DEFAULT_GRAPH_NAME, createdAt: '2026-10-31T09:00:00.000Z', saved: null });
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});

describe('openGraph', () => {
  it('throws when the graph does not exist', async () => {
    await expect(openGraph(freshStores(), 'nope')).rejects.toThrow(/no saved graph/);
  });

  it('loads a saved graph with nothing pending when there is no draft', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    await stores.repository.save(saved);

    const result = await openGraph(stores, 'd1');
    expect(result.opened).toEqual(openedFromDocument(saved));
    expect(result.pending).toBeNull();
  });

  it('reports a draft with unsaved work as pending', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    await stores.repository.save(saved);
    await stores.drafts.save(createDraft(updateDocument(saved, movedNodes, tenAm), saved.updatedAt));

    const result = await openGraph(stores, 'd1');
    expect(result.pending?.verdict).toBe('restore');
  });

  it('reports a conflict when the saved graph changed after the draft started', async () => {
    const stores = freshStores();
    const original = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    const draft = createDraft(updateDocument(original, movedNodes, tenAm), original.updatedAt);
    await stores.drafts.save(draft);
    await stores.repository.save(updateDocument(original, { ...twoNodes, directed: false }, elevenAm));

    const result = await openGraph(stores, 'd1');
    expect(result.pending?.verdict).toBe('conflict');
  });

  it('quietly deletes a draft that adds nothing', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    await stores.repository.save(saved);
    await stores.drafts.save(createDraft(saved, saved.updatedAt));

    const result = await openGraph(stores, 'd1');
    expect(result.pending).toBeNull();
    expect(await stores.drafts.get('d1')).toBeNull();
  });
});

describe('applyDraft and recoverFromDraft', () => {
  const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
  const work = updateDocument({ ...saved, name: 'Renamed in draft' }, movedNodes, tenAm);
  const draft = createDraft(work, saved.updatedAt);

  it('puts the draft content and name on top of the saved graph, keeping the saved snapshot', () => {
    const result = applyDraft(openedFromDocument(saved), draft);
    expect(result.info.name).toBe('Renamed in draft');
    expect(result.info.saved).toEqual(saved);
    expect(result.graph.nodes[0].x).toBe(99);
  });

  it('rebuilds a never-saved graph from its draft', () => {
    const result = recoverFromDraft(createDraft(createDocument(twoNodes, 'Lost work', 'new1', nineAm), null));
    expect(result.info).toMatchObject({ id: 'new1', name: 'Lost work', saved: null });
    expect(result.graph.nodes).toHaveLength(2);
  });
});

describe('saveGraph', () => {
  it('saves a never-saved graph, remembering when it was created', async () => {
    const stores = freshStores();
    const { info } = startNewGraph('new1', nineAm);

    const next = await saveGraph(stores, info, { name: 'First save', graph: twoNodes }, tenAm);

    const stored = await stores.repository.get('new1');
    expect(stored).toMatchObject({
      id: 'new1',
      name: 'First save',
      createdAt: '2026-10-31T09:00:00.000Z',
      updatedAt: '2026-10-31T10:00:00.000Z',
    });
    expect(next.saved).toEqual(stored);
    expect(next.name).toBe('First save');
  });

  it('keeps the id and creation time on later saves, and moves updatedAt forward', async () => {
    const stores = freshStores();
    const first = await saveGraph(stores, startNewGraph('new1', nineAm).info, { name: 'G', graph: twoNodes }, tenAm);
    const second = await saveGraph(stores, first, { name: 'G', graph: movedNodes }, elevenAm);

    expect(second.saved).toMatchObject({
      id: 'new1',
      createdAt: '2026-10-31T09:00:00.000Z',
      updatedAt: '2026-10-31T11:00:00.000Z',
    });
    expect(await stores.repository.list()).toHaveLength(1);
  });

  it('clears the draft', async () => {
    const stores = freshStores();
    const { info } = startNewGraph('new1', nineAm);
    await stores.drafts.save(createDraft(createDocument(twoNodes, 'G', 'new1', nineAm), null));

    await saveGraph(stores, info, { name: 'G', graph: twoNodes }, tenAm);
    expect(await stores.drafts.get('new1')).toBeNull();
  });

  it('turns an empty or oversized name into a valid one', async () => {
    const stores = freshStores();
    const { info } = startNewGraph('new1', nineAm);
    const next = await saveGraph(stores, info, { name: '   ', graph: twoNodes }, tenAm);
    expect(next.name).toBe(DEFAULT_GRAPH_NAME);
  });

  it('fails and keeps the draft when the repository cannot save', async () => {
    const stores = freshStores();
    stores.repository.save = async () => {
      throw new Error('disk full');
    };
    const { info } = startNewGraph('new1', nineAm);
    await stores.drafts.save(createDraft(createDocument(twoNodes, 'G', 'new1', nineAm), null));

    await expect(saveGraph(stores, info, { name: 'G', graph: twoNodes }, tenAm)).rejects.toThrow('disk full');
    expect(await stores.drafts.get('new1')).not.toBeNull();
  });

  it('still counts as saved when only the draft cleanup fails', async () => {
    const stores = freshStores();
    stores.drafts.delete = async () => {
      throw new Error('cleanup failed');
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { info } = startNewGraph('new1', nineAm);

    const next = await saveGraph(stores, info, { name: 'G', graph: twoNodes }, tenAm);
    expect(next.saved).not.toBeNull();
    expect(await stores.repository.get('new1')).not.toBeNull();
    vi.restoreAllMocks();
  });
});

describe('saveGraphAs', () => {
  it('creates a new graph and leaves the original as it was last saved', async () => {
    const stores = freshStores();
    const original = createDocument(twoNodes, 'Original', 'd1', nineAm);
    await stores.repository.save(original);
    await stores.drafts.save(createDraft(updateDocument(original, movedNodes, tenAm), original.updatedAt));
    const { info } = openedFromDocument(original);

    const next = await saveGraphAs(stores, info, { name: 'Original', graph: movedNodes }, 'A copy', elevenAm, 'd2');

    expect(next).toMatchObject({ id: 'd2', name: 'A copy' });
    expect((await stores.repository.get('d2'))?.graph.nodes[0].x).toBe(99);
    expect((await stores.repository.get('d1'))?.graph.nodes[0].x).toBe(10);
    expect(await stores.drafts.get('d1')).toBeNull();
  });
});

describe('revertGraph', () => {
  it('goes back to the saved version and removes the draft', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    await stores.repository.save(saved);
    await stores.drafts.save(createDraft(updateDocument(saved, movedNodes, tenAm), saved.updatedAt));

    const result = await revertGraph(stores, openedFromDocument(saved).info);
    expect(result.graph.nodes[0].x).toBe(10);
    expect(await stores.drafts.get('d1')).toBeNull();
  });

  it('goes back to a blank graph when it was never saved', async () => {
    const stores = freshStores();
    const { info } = startNewGraph('new1', nineAm);
    await stores.drafts.save(createDraft(createDocument(twoNodes, 'G', 'new1', nineAm), null));

    const result = await revertGraph(stores, info);
    expect(result.graph.nodes).toEqual([]);
    expect(result.info.saved).toBeNull();
    expect(await stores.drafts.get('new1')).toBeNull();
  });
});

describe('autosaveDraft', () => {
  it('writes a draft of a never-saved graph that has content', async () => {
    const stores = freshStores();
    const { info } = startNewGraph('new1', nineAm);

    const outcome = await autosaveDraft(stores, info, { name: 'Work in progress', graph: twoNodes }, tenAm);

    expect(outcome).toBe('written');
    const draft = await stores.drafts.get('new1');
    expect(draft).toMatchObject({ basedOn: null, draftedAt: '2026-10-31T10:00:00.000Z' });
    expect(draft?.document).toMatchObject({ id: 'new1', name: 'Work in progress', createdAt: '2026-10-31T09:00:00.000Z' });
  });

  it('remembers which saved version a draft was based on', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    const { info } = openedFromDocument(saved);

    await autosaveDraft(stores, info, { name: 'My graph', graph: movedNodes }, tenAm);

    expect((await stores.drafts.get('d1'))?.basedOn).toBe(saved.updatedAt);
  });

  it('removes the draft when nothing differs from the saved version any more', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);
    const { info } = openedFromDocument(saved);
    await autosaveDraft(stores, info, { name: 'My graph', graph: movedNodes }, tenAm);

    const outcome = await autosaveDraft(stores, info, { name: 'My graph', graph: twoNodes }, elevenAm);

    expect(outcome).toBe('cleared');
    expect(await stores.drafts.get('d1')).toBeNull();
  });

  it('keeps a draft valid even if the name is blank', async () => {
    const stores = freshStores();
    const { info } = startNewGraph('new1', nineAm);
    await autosaveDraft(stores, info, { name: '   ', graph: twoNodes }, tenAm);
    expect((await stores.drafts.get('new1'))?.document.name).toBe(DEFAULT_GRAPH_NAME);
  });
});

describe('openedFromImport', () => {
  const fromFile = createDocument(twoNodes, 'Shared graph', 'id-from-the-file', nineAm);

  it('keeps the name and the graph, but gives it a brand new id', () => {
    const result = openedFromImport(fromFile, 'fresh-id', tenAm);
    expect(result.info).toEqual({
      id: 'fresh-id',
      name: 'Shared graph',
      createdAt: '2026-10-31T10:00:00.000Z',
      saved: null,
    });
    expect(result.graph).toEqual(twoNodes);
  });

  it('never reuses the id that was in the file', () => {
    expect(openedFromImport(fromFile).info.id).not.toBe('id-from-the-file');
  });
});

describe('buildDocument', () => {
  it('describes the working copy, keeping the id and creation time of the open graph', () => {
    const { info } = startNewGraph('new1', nineAm);
    const doc = buildDocument(info, { name: '  My graph  ', graph: movedNodes }, tenAm);
    expect(doc).toMatchObject({
      id: 'new1',
      name: 'My graph',
      createdAt: '2026-10-31T09:00:00.000Z',
      updatedAt: '2026-10-31T10:00:00.000Z',
    });
    expect(doc.graph.nodes[0].x).toBe(99);
  });

  describe('findRecoverableDrafts', () => {
  const blank = { directed: true, weighted: false, nodes: [], edges: [] };

  it('finds unsaved graphs that have content, newest first', async () => {
    const stores = freshStores();
    await stores.drafts.save(createDraft(createDocument(twoNodes, 'Older', 'a', nineAm), null, nineAm));
    await stores.drafts.save(createDraft(createDocument(twoNodes, 'Newer', 'b', nineAm), null, tenAm));

    const found = await findRecoverableDrafts(stores);

    expect(found.map((draft) => draft.document.name)).toEqual(['Newer', 'Older']);
  });

  it('leaves out drafts of saved graphs, which are offered when that graph is opened', async () => {
    const stores = freshStores();
    const saved = createDocument(twoNodes, 'Saved one', 'd1', nineAm);
    await stores.repository.save(saved);
    await stores.drafts.save(createDraft(updateDocument(saved, movedNodes, tenAm), saved.updatedAt));

    expect(await findRecoverableDrafts(stores)).toEqual([]);
    expect(await stores.drafts.get('d1')).not.toBeNull(); // untouched
  });

  it('quietly removes the draft of a blank graph that was never saved', async () => {
    const stores = freshStores();
    await stores.drafts.save(createDraft(createDocument(blank, DEFAULT_GRAPH_NAME, 'empty', nineAm), null));

    expect(await findRecoverableDrafts(stores)).toEqual([]);
    expect(await stores.drafts.get('empty')).toBeNull();
  });

  it('does not treat a saved graph that cannot be read as an unsaved one', async () => {
    const stores = freshStores();
    await stores.drafts.save(createDraft(createDocument(twoNodes, 'Mystery', 'd1', nineAm), null));
    stores.repository.get = async () => {
      throw new Error('damaged');
    };

    expect(await findRecoverableDrafts(stores)).toEqual([]);
    expect(await stores.drafts.get('d1')).not.toBeNull();
  });

  it('finds nothing when there are no drafts', async () => {
    expect(await findRecoverableDrafts(freshStores())).toEqual([]);
  });
});
});