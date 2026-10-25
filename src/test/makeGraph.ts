import type { GraphData } from '../types/graph';

/**
 * Builds a graph from compact notation for tests.
 * Node ids are the labels themselves; edge ids are "A>B".
 *   makeGraph('ABCD', ['A>B', 'A>C'], { directed: true })
 */
export function makeGraph(labels: string, edges: string[], options: { directed?: boolean; weighted?: boolean } = {}): GraphData {
  return {
    directed: options.directed ?? true,
    weighted: options.weighted ?? false,
    nodes: [...labels].map((label, index) => ({ id: label, label, x: 100 + index * 80, y: 200 })),
    edges: edges.map((edge) => {
      const [source, destination] = edge.split('>');
      return { id: edge, source, destination };
    }),
  };
}
