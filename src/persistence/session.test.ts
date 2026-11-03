import { describe, expect, it } from 'vitest';
import { graphReducer, initialGraphState } from '../hooks/graphReducer';
import { createDocument, updateDocument } from './convert';
import { createDraft } from './draft';
import { classifyDraft, contentKey, DEFAULT_GRAPH_NAME, getSaveStatus, hasUnsavedChanges, normalizeName } from './session';
import { LIMITS } from './limits';

const nineAm = new Date('2026-10-31T09:00:00.000Z');
const tenAm = new Date('2026-10-31T10:00:00.000Z');

const twoNodes = {
  directed: true,
  weighted: false,
  nodes: [
    { id: 'a', x: 10, y: 10, label: 'A' },
    { id: 'b', x: 50, y: 50, label: 'B' },
  ],
  edges: [{ id: 'e1', source: 'a', destination: 'b' }],
};
const emptyGraph = { directed: true, weighted: false, nodes: [], edges: [] };

const saved = createDocument(twoNodes, 'My graph', 'd1', nineAm);

describe('contentKey', () => {
  it('ignores timestamps', () => {
    const later = updateDocument(saved, twoNodes, tenAm);
    expect(contentKey(later)).toBe(contentKey(saved));
  });

  it('ignores the editor session-only version counter', () => {
    const state = graphReducer(initialGraphState, { type: 'node/add', id: 'a', x: 10, y: 10 });
    const withVersion = { name: 'x', graph: state };
    const withoutVersion = { name: 'x', graph: { ...state, version: 999 } };
    expect(contentKey(withVersion)).toBe(contentKey(withoutVersion));
  });

  it('ignores spaces around the name', () => {
    expect(contentKey({ name: '  My graph ', graph: twoNodes })).toBe(contentKey({ name: 'My graph', graph: twoNodes }));
  });

  it('changes when a node moves', () => {
    const moved = { ...twoNodes, nodes: [{ ...twoNodes.nodes[0], x: 99 }, twoNodes.nodes[1]] };
    expect(contentKey({ name: 'My graph', graph: moved })).not.toBe(contentKey(saved));
  });

  it('changes when an edge weight changes', () => {
    const weighted = (weight: number) => ({
      ...twoNodes,
      weighted: true,
      edges: [{ id: 'e1', source: 'a', destination: 'b', weight }],
    });
    expect(contentKey({ name: 'g', graph: weighted(1) })).not.toBe(contentKey({ name: 'g', graph: weighted(2) }));
  });
});

describe('hasUnsavedChanges', () => {
  it('is false for a blank, untouched, never-saved graph', () => {
    expect(hasUnsavedChanges({ name: DEFAULT_GRAPH_NAME, graph: emptyGraph }, null)).toBe(false);
  });

  it('is true for a never-saved graph with a node', () => {
    expect(hasUnsavedChanges({ name: DEFAULT_GRAPH_NAME, graph: twoNodes }, null)).toBe(true);
  });

  it('is true for a never-saved blank graph that was renamed', () => {
    expect(hasUnsavedChanges({ name: 'Plans', graph: emptyGraph }, null)).toBe(true);
  });

  it('is false when the saved graph and the working copy match', () => {
    expect(hasUnsavedChanges({ name: 'My graph', graph: twoNodes }, saved)).toBe(false);
  });

  it('is false when only spaces around the name differ', () => {
    expect(hasUnsavedChanges({ name: 'My graph  ', graph: twoNodes }, saved)).toBe(false);
  });

  it('is true when a node was moved', () => {
    const moved = { ...twoNodes, nodes: [{ ...twoNodes.nodes[0], y: 77 }, twoNodes.nodes[1]] };
    expect(hasUnsavedChanges({ name: 'My graph', graph: moved }, saved)).toBe(true);
  });

  it('is true when the graph was renamed', () => {
    expect(hasUnsavedChanges({ name: 'Renamed', graph: twoNodes }, saved)).toBe(true);
  });

  it('is true when something was deleted', () => {
    expect(hasUnsavedChanges({ name: 'My graph', graph: emptyGraph }, saved)).toBe(true);
  });
});

describe('getSaveStatus', () => {
  it('reports saved or unsaved when nothing is happening', () => {
    expect(getSaveStatus(false, 'idle')).toBe('saved');
    expect(getSaveStatus(true, 'idle')).toBe('unsaved');
  });

  it('reports saving while a save is running, even if there are changes', () => {
    expect(getSaveStatus(true, 'saving')).toBe('saving');
  });

  it('reports an error after a failed save, so it never claims to be saved', () => {
    expect(getSaveStatus(false, 'failed')).toBe('error');
    expect(getSaveStatus(true, 'failed')).toBe('error');
  });
});

describe('classifyDraft', () => {
  const movedGraph = { ...twoNodes, nodes: [{ ...twoNodes.nodes[0], x: 99 }, twoNodes.nodes[1]] };
  const workedOn = updateDocument(saved, movedGraph, tenAm);

  it('offers to restore a draft of a never-saved graph that has content', () => {
    const draft = createDraft(createDocument(twoNodes, DEFAULT_GRAPH_NAME, 'new1', nineAm), null);
    expect(classifyDraft(draft, null)).toBe('restore');
  });

  it('discards a draft of a never-saved graph that is still blank', () => {
    const draft = createDraft(createDocument(emptyGraph, DEFAULT_GRAPH_NAME, 'new1', nineAm), null);
    expect(classifyDraft(draft, null)).toBe('discard');
  });

  it('discards a draft that matches the saved version', () => {
    const draft = createDraft(saved, saved.updatedAt);
    expect(classifyDraft(draft, saved)).toBe('discard');
  });

  it('offers to restore a draft with changes made on top of the current saved version', () => {
    const draft = createDraft(workedOn, saved.updatedAt);
    expect(classifyDraft(draft, saved)).toBe('restore');
  });

  it('reports a conflict when the saved version changed after the draft started', () => {
    const draft = createDraft(workedOn, saved.updatedAt);
    const savedElsewhere = updateDocument(saved, { ...twoNodes, directed: false }, new Date('2026-10-31T11:00:00.000Z'));
    expect(classifyDraft(draft, savedElsewhere)).toBe('conflict');
  });

  it('discards a stale draft that happens to match the newer saved version anyway', () => {
    const draft = createDraft(saved, '2026-10-30T00:00:00.000Z');
    expect(classifyDraft(draft, saved)).toBe('discard');
  });
});

describe('normalizeName', () => {
  it('trims spaces around the name', () => {
    expect(normalizeName('  Hello  ')).toBe('Hello');
  });

  it('falls back to the default name when nothing is left', () => {
    expect(normalizeName('   ')).toBe(DEFAULT_GRAPH_NAME);
    expect(normalizeName('')).toBe(DEFAULT_GRAPH_NAME);
  });

  it('shortens a name that is too long', () => {
    const result = normalizeName('x'.repeat(LIMITS.maxNameLength + 50));
    expect(result).toHaveLength(LIMITS.maxNameLength);
  });
});