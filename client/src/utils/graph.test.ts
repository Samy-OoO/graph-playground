import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { canAddEdge, findReciprocalEdgeIds, formatAdjacencyRows } from './graph';

describe('formatAdjacencyRows', () => {
  it('lists neighbors per node', () => {
    const rows = formatAdjacencyRows(makeGraph('ABC', ['A>B', 'A>C']));
    expect(rows).toEqual([
      { id: 'A', label: 'A', neighbors: ['B', 'C'] },
      { id: 'B', label: 'B', neighbors: [] },
      { id: 'C', label: 'C', neighbors: [] },
    ]);
  });

  it('lists both directions for undirected graphs', () => {
    const rows = formatAdjacencyRows(makeGraph('AB', ['A>B'], { directed: false }));
    expect(rows.map((row) => row.neighbors)).toEqual([['B'], ['A']]);
  });

  it('shows weights when the graph is weighted', () => {
    const graph = makeGraph('AB', ['A>B'], { weighted: true });
    graph.edges[0].weight = 4;
    expect(formatAdjacencyRows(graph)[0].neighbors).toEqual(['B (4)']);
  });
});

describe('canAddEdge', () => {
  const edges = makeGraph('AB', ['A>B']).edges;

  it('blocks self-loops', () => expect(canAddEdge([], true, 'A', 'A')).toBe(false));
  it('blocks exact duplicates', () => expect(canAddEdge(edges, true, 'A', 'B')).toBe(false));
  it('allows the reverse edge in a directed graph', () => expect(canAddEdge(edges, true, 'B', 'A')).toBe(true));
  it('blocks the reverse edge in an undirected graph', () => expect(canAddEdge(edges, false, 'B', 'A')).toBe(false));
});

describe('findReciprocalEdgeIds', () => {
  it('finds edges that have a twin running the other way', () => {
    const edges = makeGraph('ABC', ['A>B', 'B>A', 'B>C']).edges;
    expect(findReciprocalEdgeIds(edges)).toEqual(new Set(['A>B', 'B>A']));
  });
});
