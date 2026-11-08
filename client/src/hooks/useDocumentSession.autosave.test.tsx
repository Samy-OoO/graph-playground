// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument, updateDocument } from '../persistence/convert';
import { createDraft } from '../persistence/draft';
import { MemoryDraftStore } from '../persistence/memoryDraftStore';
import { MemoryRepository } from '../persistence/memoryRepository';
import { StorageProvider } from '../persistence/StorageProvider';
import { useDocumentSession } from './useDocumentSession';
import { useGraph } from './useGraph';

const DELAY = 1500;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
      const session = useDocumentSession(graph, { autosaveDelayMs: DELAY });
      return { graph, session };
    },
    { wrapper },
  );
  return { ...hook, repository, drafts };
}

/** Lets the given amount of fake time pass, and lets any resulting storage work finish. */
async function passTime(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('autosave', () => {
  it('writes a draft only after editing has stopped for a while', async () => {
    const { result, drafts } = setup();
    act(() => result.current.graph.addNode(10, 20));

    await passTime(DELAY - 500);
    expect(await drafts.get(result.current.session.id)).toBeNull();

    await passTime(600);
    const draft = await drafts.get(result.current.session.id);
    expect(draft?.document.graph.nodes).toHaveLength(1);
    expect(draft?.basedOn).toBeNull();
  });

  it('starts waiting again every time the graph changes', async () => {
    const { result, drafts } = setup();
    act(() => result.current.graph.addNode(10, 20));
    await passTime(DELAY - 500);

    act(() => result.current.graph.addNode(60, 70));
    await passTime(DELAY - 500);
    expect(await drafts.get(result.current.session.id)).toBeNull();

    await passTime(600);
    const draft = await drafts.get(result.current.session.id);
    expect(draft?.document.graph.nodes).toHaveLength(2);
  });

  it('reports when the draft was last written', async () => {
    const { result } = setup();
    expect(result.current.session.draftSavedAt).toBeNull();

    act(() => result.current.graph.addNode(10, 20));
    await passTime(DELAY + 100);

    expect(result.current.session.draftSavedAt).toBeInstanceOf(Date);
  });

  it('bases the draft of a saved graph on the saved version', async () => {
    const { result, repository, drafts } = setup();
    const saved = createDocument(twoNodes, 'Stored graph', 'd1', nineAm);
    await repository.save(saved);
    await act(async () => {
      await result.current.session.open('d1');
    });

    act(() => result.current.graph.addNode(300, 300));
    await passTime(DELAY + 100);

    expect((await drafts.get('d1'))?.basedOn).toBe(saved.updatedAt);
  });

  it('does not bring the draft back after the graph is saved', async () => {
    const { result, drafts } = setup();
    act(() => result.current.graph.addNode(10, 20));
    await passTime(DELAY + 100);
    expect(await drafts.get(result.current.session.id)).not.toBeNull();

    await act(async () => {
      await result.current.session.save();
    });
    await passTime(DELAY * 3);

    expect(await drafts.get(result.current.session.id)).toBeNull();
    expect(result.current.session.draftSavedAt).toBeNull();
  });

  it('removes the draft when the changes are undone by hand', async () => {
    const { result, repository, drafts } = setup();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', nineAm));
    await act(async () => {
      await result.current.session.open('d1');
    });

    act(() => result.current.graph.addNode(300, 300));
    await passTime(DELAY + 100);
    expect(await drafts.get('d1')).not.toBeNull();

    const addedId = result.current.graph.nodes[2].id;
    act(() => result.current.graph.deleteNode(addedId));
    await passTime(DELAY + 100);

    expect(await drafts.get('d1')).toBeNull();
  });

  it('does not overwrite a draft the user is still deciding about, even if the graph is edited meanwhile', async () => {
    const { result, repository, drafts } = setup();
    const saved = createDocument(twoNodes, 'Stored graph', 'd1', nineAm);
    await repository.save(saved);
    const original = createDraft(updateDocument(saved, movedNodes, tenAm), saved.updatedAt);
    await drafts.save(original);

    await act(async () => {
      await result.current.session.open('d1');
    });
    expect(result.current.session.pending).not.toBeNull();

    act(() => result.current.graph.addNode(300, 300));
    await passTime(DELAY * 4);

    expect(await drafts.get('d1')).toEqual(original);
  });

  it('does not touch storage for a graph nobody has edited', async () => {
    const { drafts } = setup();
    const save = vi.spyOn(drafts, 'save');
    const remove = vi.spyOn(drafts, 'delete');

    await passTime(DELAY * 4);

    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('writes the draft straight away when the tab is hidden', async () => {
    const { result, drafts } = setup();
    act(() => result.current.graph.addNode(10, 20));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    expect(await drafts.get(result.current.session.id)).not.toBeNull();
  });

  it('keeps working, and tries again later, when the draft cannot be written', async () => {
    const { result, drafts } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realSave = drafts.save.bind(drafts);
    drafts.save = async () => {
      throw new Error('quota exceeded');
    };

    act(() => result.current.graph.addNode(10, 20));
    await passTime(DELAY + 100);
    expect(result.current.session.status).toBe('unsaved');
    expect(await drafts.get(result.current.session.id)).toBeNull();

    drafts.save = realSave;
    act(() => result.current.graph.addNode(60, 70));
    await passTime(DELAY + 100);
    expect(await drafts.get(result.current.session.id)).not.toBeNull();
  });
});