import { describe, expect, it } from 'vitest';
import { createDocument } from './convert';
import { toSummary } from './repository';

describe('toSummary', () => {
  const doc = createDocument(
    {
      directed: true,
      weighted: false,
      nodes: [
        { id: 'a', x: 1, y: 1, label: 'A' },
        { id: 'b', x: 2, y: 2, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'a', destination: 'b' }],
    },
    'Two nodes',
    'doc-1',
    new Date('2026-10-31T09:00:00.000Z'),
  );

  it('copies the identifying fields and counts nodes and edges', () => {
    expect(toSummary(doc)).toEqual({
      id: 'doc-1',
      name: 'Two nodes',
      createdAt: '2026-10-31T09:00:00.000Z',
      updatedAt: '2026-10-31T09:00:00.000Z',
      nodeCount: 2,
      edgeCount: 1,
      thumbnail: expect.stringContaining('<svg'),
    });
  });

  it('does not carry the graph itself', () => {
    expect(toSummary(doc)).not.toHaveProperty('graph');
  });
  
  it('includes a picture of the graph, with a circle for each node', () => {
    expect((toSummary(doc).thumbnail.match(/<circle/g) ?? []).length).toBe(2);
  });
});