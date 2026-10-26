import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generatePrimSteps } from './prim';

const options = { directed: false, weighted: true };
const graph = makeGraph('ABCD', ['A>B:1', 'A>C:4', 'B>C:2', 'C>D:3', 'B>D:5'], options);

describe('generatePrimSteps', () => {
  it('returns nothing for an unknown start node', () => {
    expect(generatePrimSteps(graph, 'Z')).toEqual([]);
  });

  it('asks for an undirected graph instead of running', () => {
    const steps = generatePrimSteps(makeGraph('AB', ['A>B:1'], { weighted: true }), 'A');
    expect(steps).toHaveLength(1);
    expect(steps[0].message).toContain('undirected');
  });

  it('builds the minimum spanning tree', () => {
    const last = generatePrimSteps(graph, 'A').at(-1)!;
    expect(last.message).toContain('minimum spanning tree has A–B, B–C, C–D');
    expect(last.message).toContain('Total weight: 6');
    expect(last.edgeStatus).toEqual({ 'A>B': 'settled', 'B>C': 'settled', 'C>D': 'settled' });
  });

  it('finds the same total weight from every start node', () => {
    for (const start of 'ABCD') {
      expect(generatePrimSteps(graph, start).at(-1)!.message).toContain('Total weight: 6');
    }
  });

  it('shows the queued edges, cheapest first', () => {
    const steps = generatePrimSteps(graph, 'A');
    const queuedBD = steps.find((step) => step.message.startsWith('Queue B–D'))!;
    expect(queuedBD.structure?.items).toEqual(['B–C (2)', 'A–C (4)', 'B–D (5)']);
  });

  it('highlights the edge being taken, then keeps it as a tree edge', () => {
    const steps = generatePrimSteps(graph, 'A');
    const index = steps.findIndex((step) => step.message.startsWith('Take the cheapest edge A–B'));

    expect(steps[index].edgeStatus['A>B']).toBe('active');
    expect(steps[index].traversal).toEqual({ edgeId: 'A>B', fromNodeId: 'A' });
    expect(steps[index].nodeStatus['B']).toBe('current');
    expect(steps[index + 1].edgeStatus['A>B']).toBe('settled');
  });

  it('skips a queued edge whose far end already joined the tree', () => {
    const skip = generatePrimSteps(graph, 'A').find((step) => step.message.startsWith('Skip A–C'))!;
    expect(skip.message).toContain('would form a cycle');
    expect(skip.edgeStatus['A>C']).toBe('skipped');
  });

  it('builds a spanning forest when the graph is disconnected', () => {
    const forest = makeGraph('ABCD', ['A>B:1', 'C>D:2'], options);
    const last = generatePrimSteps(forest, 'A').at(-1)!;
    expect(last.message).toContain('forest (2 trees)');
    expect(last.message).toContain('Total weight: 3');
  });

  it('treats every edge as weight 1 when the graph is unweighted', () => {
    const unweighted = makeGraph('ABC', ['A>B', 'B>C', 'A>C'], { directed: false });
    expect(generatePrimSteps(unweighted, 'A').at(-1)!.message).toContain('Total weight: 2');
  });
});