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
    expect(last.message).toContain('Minimum Spanning Tree has A ↔ B, B ↔ C, C ↔ D');
    expect(last.message).toContain('Total weight: 6');
    expect(last.edgeStatus).toEqual({ 'A>B': 'settled', 'B>C': 'settled', 'C>D': 'settled' });
  });

  it('finds the same total weight from every start node', () => {
    for (const start of 'ABCD') {
      expect(generatePrimSteps(graph, start).at(-1)!.message).toContain('Total weight: 6');
    }
  });

  it('lists only the cheapest edge to each outside node, cheapest first', () => {
    const steps = generatePrimSteps(graph, 'A');
    const afterA = steps.find((step) => step.message.startsWith('Check the edges from A'))!;
    expect(afterA.structure?.items).toEqual(['A ↔ B (1)', 'A ↔ C (4)']);

    const afterB = steps.find((step) => step.message.startsWith('Check the edges from B'))!;
    expect(afterB.structure?.items).toEqual(['B ↔ C (2)', 'B ↔ D (5)']);
  });

  it('only highlights one candidate edge per node outside the tree', () => {
    for (const step of generatePrimSteps(graph, 'A')) {
      const active = Object.values(step.edgeStatus).filter((status) => status === 'active').length;
      const outside = Object.values(step.nodeStatus).filter((status) => status === 'queued').length;
      expect(active).toBeLessThanOrEqual(outside + 1); // +1 for the edge being taken
    }
  });

  it('highlights the edge being taken, then keeps it as a tree edge', () => {
    const steps = generatePrimSteps(graph, 'A');
    const index = steps.findIndex((step) => step.message.startsWith('Take the cheapest edge A ↔ B'));

    expect(steps[index].edgeStatus['A>B']).toBe('active');
    expect(steps[index].traversal).toEqual({ edgeId: 'A>B', fromNodeId: 'A' });
    expect(steps[index].nodeStatus['B']).toBe('current');
    expect(steps[index + 1].edgeStatus['A>B']).toBe('settled');
  });

  it('swaps a candidate edge out when a cheaper one to the same node appears', () => {
    const steps = generatePrimSteps(graph, 'A');
    const check = steps.find((step) => step.message.startsWith('Check the edges from B'))!;
    expect(check.message).toContain('B ↔ C (2) replaces A ↔ C (4)');
    expect(check.edgeStatus['A>C']).toBe('skipped');
    expect(check.edgeStatus['B>C']).toBe('active');

    const later = steps.find((step) => step.message.startsWith('Take the cheapest edge B ↔ C'))!;
    expect(later.edgeStatus['A>C']).toBeUndefined();
  });

  it('builds a spanning forest when the graph is disconnected', () => {
    const forest = makeGraph('ABCD', ['A>B:1', 'C>D:2'], options);
    const last = generatePrimSteps(forest, 'A').at(-1)!;
    expect(last.message).toContain('Forest (2 trees)');
    expect(last.message).toContain('Total weight: 3');
  });

  it('treats every edge as weight 1 when the graph is unweighted', () => {
    const unweighted = makeGraph('ABC', ['A>B', 'B>C', 'A>C'], { directed: false });
    expect(generatePrimSteps(unweighted, 'A').at(-1)!.message).toContain('Total weight: 2');
  });
});