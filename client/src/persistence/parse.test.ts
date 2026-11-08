import { describe, expect, it } from 'vitest';
import { createDocument } from './convert';
import { LIMITS } from './limits';
import { parseDocumentData, parseDocumentText } from './parse';

const emptyGraph = { directed: true, weighted: false, nodes: [], edges: [] };
const validDocument = createDocument(emptyGraph, 'Test', 'doc-1', new Date('2026-10-31T09:00:00.000Z'));

describe('parseDocumentText', () => {
  it('accepts a valid file', () => {
    const result = parseDocumentText(JSON.stringify(validDocument));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.id).toBe('doc-1');
  });

  it('rejects text that is not JSON', () => {
    const result = parseDocumentText('this is not json');
    expect(result).toEqual({ ok: false, errors: ['The file is not valid JSON.'] });
  });

  it('rejects a file that is too large, before parsing it', () => {
    const result = parseDocumentText('x'.repeat(LIMITS.maxFileBytes + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/too large/);
  });

  it('rejects JSON that has no schemaVersion', () => {
    const result = parseDocumentText('{"hello": "world"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/does not look like/);
  });

  it('rejects JSON that is not an object at all', () => {
    expect(parseDocumentText('[1, 2, 3]').ok).toBe(false);
    expect(parseDocumentText('42').ok).toBe(false);
  });

  it('rejects a file from a newer version of the app', () => {
    const result = parseDocumentText(JSON.stringify({ ...validDocument, schemaVersion: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/newer version/);
  });
});

describe('parseDocumentData', () => {
  it('reports where the problem is', () => {
    const broken = {
      ...validDocument,
      graph: {
        ...emptyGraph,
        nodes: [{ id: 'a', x: 1, y: 1, label: 'A' }],
        edges: [{ id: 'e1', source: 'a', destination: 'ghost' }],
      },
    };
    const result = parseDocumentData(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('graph.edges[0].destination');
  });

  it('shortens a long list of problems', () => {
    const edges = Array.from({ length: 10 }, (_, i) => ({ id: `e${i}`, source: 'ghost', destination: 'ghost2' }));
    const result = parseDocumentData({ ...validDocument, graph: { ...emptyGraph, edges } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeLessThanOrEqual(6);
      expect(result.errors[result.errors.length - 1]).toMatch(/more problem/);
    }
  });

  it('accepts an object that is already parsed', () => {
    expect(parseDocumentData(validDocument).ok).toBe(true);
  });
});