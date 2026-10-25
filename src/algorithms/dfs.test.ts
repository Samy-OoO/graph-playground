import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateDFSSteps } from './dfs';

const diamond = makeGraph('ABCD', ['A>B', 'A>C', 'B>D', 'C>D']);

describe('generateDFSSteps', () => {
  it('returns nothing for an unknown start node', () => {
    expect(generateDFSSteps(diamond, 'Z')).toEqual([]);
  });

  it('visits nodes depth-first and reports the visit order', () => {
    const steps = generateDFSSteps(diamond, 'A');
    const last = steps[steps.length - 1];
    expect(last.message).toContain('Visit order: A, B, D, C');
  });

  it('keeps the edges from the start node down to the current node active (neon path)', () => {
    const steps = generateDFSSteps(diamond, 'A');
    const enteringD = steps.find((step) => step.message.startsWith('Follow B → D'));

    expect(enteringD).toBeDefined();
    expect(enteringD!.edgeStatus['A>B']).toBe('active');
    expect(enteringD!.edgeStatus['B>D']).toBe('active');
    expect(enteringD!.edgeStatus['A>C']).toBeUndefined();
    expect(enteringD!.nodeStatus).toMatchObject({ A: 'onPath', B: 'onPath', D: 'current' });
    expect(enteringD!.traversal).toEqual({ edgeId: 'B>D', fromNodeId: 'B' });
    expect(enteringD!.structure?.items).toEqual(['A', 'B', 'D']);
  });

  it('turns an edge from active to settled once its subtree is finished', () => {
    const steps = generateDFSSteps(diamond, 'A');
    const backAtA = steps.find((step) => step.message.startsWith('Finished B. Backtrack to A'));

    expect(backAtA!.edgeStatus['B>D']).toBe('settled');
    expect(backAtA!.edgeStatus['A>B']).toBe('settled');
    expect(backAtA!.nodeStatus).toMatchObject({ B: 'current', D: 'visited', A: 'onPath' });
  });

  it('marks an edge to an already-visited node as skipped for that step only', () => {
    const steps = generateDFSSteps(diamond, 'A');
    const skipIndex = steps.findIndex((step) => step.message.startsWith('C → D'));

    expect(skipIndex).toBeGreaterThan(-1);
    expect(steps[skipIndex].edgeStatus['C>D']).toBe('skipped');
    expect(steps[skipIndex + 1].edgeStatus['C>D']).toBeUndefined();
  });

  it('respects edge direction in a directed graph', () => {
    const steps = generateDFSSteps(makeGraph('AB', ['A>B']), 'B');
    const last = steps[steps.length - 1];

    expect(last.message).toContain('Visit order: B.');
    expect(last.message).toContain('1 node not reachable from B');
    expect(steps.some((step) => step.nodeStatus['A'])).toBe(false);
  });

  it('walks edges both ways in an undirected graph', () => {
    const steps = generateDFSSteps(makeGraph('AB', ['A>B'], { directed: false }), 'B');
    expect(steps[steps.length - 1].message).toContain('Visit order: B, A');
  });

  it('flows the animation from the end the walk started at', () => {
    const steps = generateDFSSteps(makeGraph('AB', ['A>B'], { directed: false }), 'B');
    expect(steps.find((step) => step.traversal)?.traversal).toEqual({ edgeId: 'A>B', fromNodeId: 'B' });
  });

  it('looks at each undirected edge only once', () => {
    const triangle = makeGraph('ABC', ['A>B', 'B>C', 'A>C'], { directed: false });
    const steps = generateDFSSteps(triangle, 'A');

    expect(steps.filter((step) => Object.values(step.edgeStatus).includes('skipped'))).toHaveLength(1);
  });

  it('ends with an empty call stack and every reachable node finished', () => {
    const steps = generateDFSSteps(diamond, 'A');
    const last = steps[steps.length - 1];

    expect(last.structure?.items).toEqual([]);
    expect(last.nodeStatus).toMatchObject({ A: 'current', B: 'visited', C: 'visited', D: 'visited' });
  });
});
