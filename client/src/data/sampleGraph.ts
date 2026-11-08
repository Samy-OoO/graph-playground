import type { GraphData } from '../types/graph';

/** A small diamond: A→B, A→C, B→D, C→D. */
export const SAMPLE_GRAPH: GraphData = {
  directed: true,
  weighted: false,
  nodes: [
    { id: 'sample-a', x: 300, y: 150, label: 'A' },
    { id: 'sample-b', x: 500, y: 150, label: 'B' },
    { id: 'sample-c', x: 300, y: 350, label: 'C' },
    { id: 'sample-d', x: 500, y: 350, label: 'D' },
  ],
  edges: [
    { id: 'edge-ab', source: 'sample-a', destination: 'sample-b' },
    { id: 'edge-ac', source: 'sample-a', destination: 'sample-c' },
    { id: 'edge-bd', source: 'sample-b', destination: 'sample-d' },
    { id: 'edge-cd', source: 'sample-c', destination: 'sample-d' },
  ],
};
