// src/algorithms/kruskal.test.ts
import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateKruskalSteps } from './kruskal';

const options = { directed: false, weighted: true };

// A-B 1, A-C 4, B-C 2, B-D 5, C-D 3
const graph = makeGraph('ABCD', ['A>B:1', 'A>C:4', 'B>C:2', 'B>D:5', 'C>D:3'], options);

const groups = (step: ReturnType<typeof generateKruskalSteps>[number]) =>
  step.structure!.matrix!.rows.map((row) => row.cells[0]);

describe('generateKruskalSteps', () => {
  it('returns nothing for an empty graph', () => {
    expect(generateKruskalSteps(makeGraph('', [], options))).toEqual([]);
  });

  it('asks for an undirected graph', () => {
    const steps = generateKruskalSteps(makeGraph('AB', ['A>B:1'], { directed: true, weighted: true }));
    expect(steps).toHaveLength(1);
    expect(steps[0].message).toContain('undirected');
  });

  it('starts by sorting the edges, lightest first, with every node in its own group', () => {
    const first = generateKruskalSteps(graph)[0];
    expect(first.structure?.items).toEqual(['A ↔ B (1)', 'B ↔ C (2)', 'C ↔ D (3)', 'A ↔ C (4)', 'B ↔ D (5)']);
    expect(groups(first)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('adds an edge between two different groups and merges them', () => {
    const addAB = generateKruskalSteps(graph).find((step) => step.message.startsWith('Add A ↔ B (1)'))!;
    expect(addAB.message).toContain('Different groups, so no cycle');
    expect(addAB.edgeStatus['A>B']).toBe('active');
    expect(addAB.nodeStatus).toMatchObject({ A: 'current', B: 'current' });
    expect(addAB.traversal).toEqual({ edgeId: 'A>B', fromNodeId: 'A' });
    expect(addAB.structure?.items).toEqual(['B ↔ C (2)', 'C ↔ D (3)', 'A ↔ C (4)', 'B ↔ D (5)']);
    expect(groups(addAB)).toEqual(['A', 'A', 'C', 'D']);
  });

  it('skips an edge whose ends are already in the same group', () => {
    const withCycle = makeGraph('ABCD', ['A>B:1', 'B>C:2', 'A>C:3', 'C>D:4'], options);
    const skip = generateKruskalSteps(withCycle).find((step) => step.message.startsWith('Skip A ↔ C (3)'))!;
    expect(skip.message).toContain('already both in group A');
    expect(skip.message).toContain('would form a cycle');
    expect(skip.edgeStatus).toEqual({ 'A>B': 'settled', 'B>C': 'settled', 'A>C': 'skipped' });
    expect(skip.nodeStatus).toMatchObject({ A: 'current', C: 'current' });
    expect(groups(skip)).toEqual(['A', 'A', 'A', 'D']);

    const after = generateKruskalSteps(withCycle).find((step) => step.message.startsWith('Add C ↔ D (4)'))!;
    expect(after.edgeStatus['A>C']).toBeUndefined();
  });

  it('stops early once the tree is complete', () => {
    const steps = generateKruskalSteps(graph);
    const stop = steps.find((step) => step.message.includes('stop early'))!;
    expect(stop.message).toContain('3 edges are enough');
    expect(stop.message).toContain('remaining 2 edges');
    expect(stop.structure?.items).toEqual(['A ↔ C (4)', 'B ↔ D (5)']);
  });

  it('finishes with the tree, its edges and the total weight', () => {
    const last = generateKruskalSteps(graph).at(-1)!;
    expect(last.message).toContain('Minimum Spanning Tree has A ↔ B, B ↔ C, C ↔ D');
    expect(last.message).toContain('Total weight: 6');
    expect(last.edgeStatus).toEqual({ 'A>B': 'settled', 'B>C': 'settled', 'C>D': 'settled' });
    expect(groups(last)).toEqual(['A', 'A', 'A', 'A']);
    expect(Object.values(last.nodeStatus)).toEqual(['visited', 'visited', 'visited', 'visited']);
  });

  it('keeps equal-weight edges in the order they were drawn', () => {
    const ties = makeGraph('ABC', ['B>C:1', 'A>B:1', 'A>C:1'], options);
    expect(generateKruskalSteps(ties)[0].structure?.items).toEqual(['B ↔ C (1)', 'A ↔ B (1)', 'A ↔ C (1)']);
  });

  it('works with negative weights', () => {
    const negative = makeGraph('ABC', ['A>B:2', 'B>C:-1', 'A>C:5'], options);
    const last = generateKruskalSteps(negative).at(-1)!;
    expect(last.message).toContain('Total weight: 1');
  });

  it('counts every edge as 1 when the graph is unweighted', () => {
    const plain = makeGraph('ABC', ['A>B', 'B>C', 'A>C'], { directed: false });
    const last = generateKruskalSteps(plain).at(-1)!;
    expect(last.message).toContain('Total weight: 2');
  });

  it('builds a forest when the graph is disconnected', () => {
    const split = makeGraph('ABCDE', ['A>B:1', 'C>D:2'], options);
    const last = generateKruskalSteps(split).at(-1)!;
    expect(last.message).toContain('Minimum Spanning Forest (3 trees)');
    expect(last.message).toContain('A ↔ B, C ↔ D');
    expect(groups(last)).toEqual(['A', 'A', 'C', 'C', 'E']);
  });

  it('handles a graph without edges', () => {
    const steps = generateKruskalSteps(makeGraph('AB', [], options));
    expect(steps).toHaveLength(2);
    expect(steps[0].message).toContain('no edges');
    expect(steps[1].message).toContain('Minimum Spanning Forest (2 trees) has no edges');
  });

  it('handles a single node', () => {
    const last = generateKruskalSteps(makeGraph('A', [], options)).at(-1)!;
    expect(last.message).toContain('Minimum Spanning Tree has no edges. Total weight: 0');
  });

  it('stops before skipping anything when the tree completes first', () => {
    const triangle = makeGraph('ABC', ['A>B:1', 'B>C:1', 'A>C:1'], options);
    const steps = generateKruskalSteps(triangle);
    expect(steps.some((step) => step.message.includes('stop early'))).toBe(true);
    expect(steps.some((step) => step.message.startsWith('Skip'))).toBe(false);
  });
});