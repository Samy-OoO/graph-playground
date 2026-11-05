// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, updateDocument } from '../persistence/convert';
import { createDraft } from '../persistence/draft';
import { MemoryDraftStore } from '../persistence/memoryDraftStore';
import { MemoryRepository } from '../persistence/memoryRepository';
import { StorageProvider } from '../persistence/StorageProvider';
import { DEFAULT_GRAPH_NAME } from '../persistence/session';
import { useDocumentSession } from './useDocumentSession';
import { useGraph } from './useGraph';

afterEach(cleanup);

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
const nineAm = new Date('2026-10-31T09:00:00.000Z');
const tenAm = new Date('2026-10-31T10:00:00.000Z');

function setup() {
  const repository = new MemoryRepository();
  const drafts = new MemoryDraftStore();
  const storage = { repository, drafts, persistent: false };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <StorageProvider storage={storage}>{children}</StorageProvider>
  );
  const hook = renderHook(
    () => {
      const graph = useGraph();
      const session = useDocumentSession(graph);
      return { graph, session };
    },
    { wrapper },
  );
  return { ...hook, repository, drafts };
}

describe('useDocumentSession', () => {
  it('starts with a blank graph that counts as saved', () => {
    const { result } = setup();
    expect(result.current.session.name).toBe(DEFAULT_GRAPH_NAME);
    expect(result.current.session.status).toBe('saved');
    expect(result.current.session.isSaved).toBe(false);
  });

  it('reports unsaved changes after the graph is edited', () => {
    const { result } = setup();
    act(() => result.current.graph.addNode(10, 20));
    expect(result.current.session.status).toBe('unsaved');
  });

  it('reports unsaved changes after a rename', () => {
    const { result } = setup();
    act(() => result.current.session.setName('Plans'));
    expect(result.current.session.status).toBe('unsaved');
  });

  it('saves the graph, and is saved again afterwards', async () => {
    const { result, repository } = setup();
    act(() => result.current.graph.addNode(10, 20));
    act(() => result.current.session.setName('My first graph'));

    await act(async () => {
      await result.current.session.save();
    });

    expect(result.current.session.status).toBe('saved');
    expect(result.current.session.isSaved).toBe(true);
    const stored = await repository.get(result.current.session.id);
    expect(stored?.name).toBe('My first graph');
    expect(stored?.graph.nodes).toHaveLength(1);
  });

  it('notices changes made after a save, including moving a node', async () => {
    const { result } = setup();
    act(() => result.current.graph.addNode(10, 20));
    await act(async () => {
      await result.current.session.save();
    });

    const nodeId = result.current.graph.nodes[0].id;
    act(() => result.current.graph.moveNode(nodeId, 200, 200));
    expect(result.current.session.status).toBe('unsaved');
  });

  it('opens a saved graph into the editor', async () => {
    const { result, repository } = setup();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', nineAm));

    let opened = false;
    await act(async () => {
      opened = await result.current.session.open('d1');
    });

    expect(opened).toBe(true);
    expect(result.current.graph.nodes).toHaveLength(2);
    expect(result.current.session.name).toBe('Stored graph');
    expect(result.current.session.id).toBe('d1');
    expect(result.current.session.status).toBe('saved');
  });

  it('reports a problem when opening a graph that does not exist', async () => {
    const { result } = setup();
    act(() => result.current.graph.addNode(10, 20));

    let opened = true;
    await act(async () => {
      opened = await result.current.session.open('nope');
    });

    expect(opened).toBe(false);
    expect(result.current.session.problem).toMatch(/no saved graph/);
    expect(result.current.graph.nodes).toHaveLength(1);
  });

  it('offers unsaved work found with a graph, and restores it on request', async () => {
    const { result, repository, drafts } = setup();
    const saved = createDocument(twoNodes, 'Stored graph', 'd1', nineAm);
    await repository.save(saved);
    await drafts.save(createDraft(updateDocument(saved, movedNodes, tenAm), saved.updatedAt));

    await act(async () => {
      await result.current.session.open('d1');
    });
    expect(result.current.session.pending?.verdict).toBe('restore');
    expect(result.current.graph.nodes[0].x).toBe(10);

    act(() => result.current.session.restoreDraft());

    expect(result.current.session.pending).toBeNull();
    expect(result.current.graph.nodes[0].x).toBe(99);
    expect(result.current.session.status).toBe('unsaved');
  });

  it('throws away offered unsaved work on request', async () => {
    const { result, repository, drafts } = setup();
    const saved = createDocument(twoNodes, 'Stored graph', 'd1', nineAm);
    await repository.save(saved);
    await drafts.save(createDraft(updateDocument(saved, movedNodes, tenAm), saved.updatedAt));

    await act(async () => {
      await result.current.session.open('d1');
    });
    await act(async () => {
      await result.current.session.discardDraft();
    });

    expect(result.current.session.pending).toBeNull();
    expect(await drafts.get('d1')).toBeNull();
    expect(result.current.graph.nodes[0].x).toBe(10);
  });

  it('reverts to the saved version', async () => {
    const { result, repository } = setup();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', nineAm));
    await act(async () => {
      await result.current.session.open('d1');
    });

    act(() => result.current.graph.addNode(300, 300));
    expect(result.current.graph.nodes).toHaveLength(3);

    await act(async () => {
      await result.current.session.revert();
    });

    expect(result.current.graph.nodes).toHaveLength(2);
    expect(result.current.session.status).toBe('saved');
  });

  it('starts a new blank graph', async () => {
    const { result, repository } = setup();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', nineAm));
    await act(async () => {
      await result.current.session.open('d1');
    });

    act(() => result.current.session.newGraph());

    expect(result.current.graph.nodes).toHaveLength(0);
    expect(result.current.session.name).toBe(DEFAULT_GRAPH_NAME);
    expect(result.current.session.isSaved).toBe(false);
    expect(result.current.session.id).not.toBe('d1');
  });

  it('saves a copy with Save as and leaves the original alone', async () => {
    const { result, repository } = setup();
    await repository.save(createDocument(twoNodes, 'Original', 'd1', nineAm));
    await act(async () => {
      await result.current.session.open('d1');
    });
    act(() => result.current.graph.addNode(300, 300));

    await act(async () => {
      await result.current.session.saveAs('Branch');
    });

    expect(result.current.session.name).toBe('Branch');
    expect(result.current.session.id).not.toBe('d1');
    expect(result.current.session.status).toBe('saved');
    expect((await repository.get('d1'))?.graph.nodes).toHaveLength(2);
    expect(await repository.list()).toHaveLength(2);
  });

  it('shows an error when saving fails, and recovers on the next successful save', async () => {
    const { result, repository } = setup();
    const realSave = repository.save.bind(repository);
    repository.save = async () => {
      throw new Error('disk full');
    };
    act(() => result.current.graph.addNode(10, 20));

    await act(async () => {
      await result.current.session.save();
    });
    expect(result.current.session.status).toBe('error');
    expect(result.current.session.problem).toBe('disk full');

    repository.save = realSave;
    await act(async () => {
      await result.current.session.save();
    });
    expect(result.current.session.status).toBe('saved');
    expect(result.current.session.problem).toBeNull();
  });

  it('keeps a name typed while a save is still running', async () => {
    const { result, repository } = setup();
    const realSave = repository.save.bind(repository);
    let finishSave: () => void = () => {};
    repository.save = async (document) => {
      await new Promise<void>((resolve) => {
        finishSave = resolve;
      });
      await realSave(document);
    };
    act(() => result.current.graph.addNode(10, 20));

    let saving: Promise<boolean> = Promise.resolve(false);
    act(() => {
      saving = result.current.session.save();
    });
    expect(result.current.session.status).toBe('saving');

    act(() => result.current.session.setName('Typed during save'));
    await act(async () => {
      finishSave();
      await saving;
    });

    expect(result.current.session.name).toBe('Typed during save');
    expect(result.current.session.status).toBe('unsaved');
  });

    it('turns an imported document into a new, unsaved graph with its own id', () => {
    const { result } = setup();
    const fromFile = createDocument(twoNodes, 'Shared graph', 'id-from-the-file', nineAm);

    act(() => result.current.session.importDocument(fromFile));

    expect(result.current.graph.nodes).toHaveLength(2);
    expect(result.current.session.name).toBe('Shared graph');
    expect(result.current.session.id).not.toBe('id-from-the-file');
    expect(result.current.session.isSaved).toBe(false);
    expect(result.current.session.status).toBe('unsaved');
  });

  it('shows a message from elsewhere in the problem banner', () => {
    const { result } = setup();
    act(() => result.current.session.reportProblem('Could not import "notes.txt"'));
    expect(result.current.session.problem).toBe('Could not import "notes.txt"');

    act(() => result.current.session.dismissProblem());
    expect(result.current.session.problem).toBeNull();
  });

  it('describes the graph as it is on screen, unsaved changes included', () => {
    const { result } = setup();
    act(() => result.current.graph.addNode(10, 20));
    act(() => result.current.session.setName('  On screen  '));

    const snapshot = result.current.session.snapshot();

    expect(snapshot.name).toBe('On screen');
    expect(snapshot.id).toBe(result.current.session.id);
    expect(snapshot.graph.nodes).toHaveLength(1);
  });
});