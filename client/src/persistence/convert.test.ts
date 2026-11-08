import { describe, expect, it } from 'vitest';
import { graphReducer, initialGraphState, type GraphState } from '../hooks/graphReducer';
import { createDocument, documentToGraph, extractGraph, updateDocument } from './convert';
import { documentSchema } from '@graph-playground/shared';

function buildState(): GraphState {
  let state = initialGraphState;
  state = graphReducer(state, { type: 'node/add', id: 'n1', x: 100, y: 100 });
  state = graphReducer(state, { type: 'node/add', id: 'n2', x: 200, y: 150 });
  state = graphReducer(state, { type: 'edge/add', id: 'e1', source: 'n1', destination: 'n2' });
  return state;
}

describe('extractGraph', () => {
  it('leaves out the session-only version counter', () => {
    const result = extractGraph(buildState());
    expect(result).not.toHaveProperty('version');
  });

  it('does not add a weight key to edges that have none', () => {
    const result = extractGraph(buildState());
    expect(result.edges[0]).not.toHaveProperty('weight');
  });
});

describe('createDocument', () => {
  const when = new Date('2026-10-31T09:00:00.000Z');

  it('builds a document with matching timestamps', () => {
    const doc = createDocument(buildState(), 'Test', 'doc-1', when);
    expect(doc.id).toBe('doc-1');
    expect(doc.createdAt).toBe('2026-10-31T09:00:00.000Z');
    expect(doc.updatedAt).toBe(doc.createdAt);
  });

  it('produces a document that passes the schema', () => {
    const doc = createDocument(buildState(), 'Test', 'doc-1', when);
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });

  it('passes the schema for weighted and undirected graphs the editor can produce', () => {
    let state = buildState();
    state = graphReducer(state, { type: 'settings/toggleWeighted' });
    state = graphReducer(state, { type: 'settings/toggleDirected' });
    const doc = createDocument(state, 'Weighted', 'doc-2', when);
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });
});

describe('updateDocument', () => {
  it('keeps id, name and createdAt but changes the graph and updatedAt', () => {
    const first = new Date('2026-10-31T09:00:00.000Z');
    const later = new Date('2026-10-31T10:00:00.000Z');
    const original = createDocument(buildState(), 'Test', 'doc-1', first);
    const moreNodes = graphReducer(buildState(), { type: 'node/add', id: 'n3', x: 50, y: 50 });

    const updated = updateDocument(original, moreNodes, later);

    expect(updated.id).toBe('doc-1');
    expect(updated.name).toBe('Test');
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBe('2026-10-31T10:00:00.000Z');
    expect(updated.graph.nodes).toHaveLength(3);
    expect(original.graph.nodes).toHaveLength(2);
  });
});

describe('documentToGraph', () => {
  it('round-trips: state to document and back gives the same graph', () => {
    const state = buildState();
    const doc = createDocument(state, 'Test', 'doc-1');
    expect(documentToGraph(doc)).toEqual(extractGraph(state));
  });

  it("returns a copy, not the document's own arrays", () => {
    const doc = createDocument(buildState(), 'Test', 'doc-1');
    const graph = documentToGraph(doc);
    expect(graph.nodes).not.toBe(doc.graph.nodes);
    expect(graph.nodes[0]).not.toBe(doc.graph.nodes[0]);
  });
});
