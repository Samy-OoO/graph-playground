import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateBFSSteps } from './bfs';

const diamond = makeGraph('ABCD', ['A>B', 'A>C', 'B>D', 'C>D']);

describe('generateBFSSteps', () => {
  it('returns nothing for an unknown start node', () => {
    expect(generateBFSSteps(diamond, 'Z')).toEqual([]);
  });

  it('visits nodes level by level', () => {
    const steps = generateBFSSteps(diamond, 'A');
    expect(steps[steps.length - 1].message).toContain('Visit order: A, B, C, D');
  });

  it('shows the queue as it changes', () => {
    const steps = generateBFSSteps(diamond, 'A');
    expect(steps[0].structure?.items).toEqual(['A']);

    const discoveredC = steps.find((step) => step.message.startsWith('Discovered C'));
    expect(discoveredC!.structure?.items).toEqual(['B', 'C']);
    expect(discoveredC!.nodeStatus).toMatchObject({ A: 'current', B: 'queued', C: 'queued' });
  });

  it('highlights the discovering edge, then keeps it as a tree edge', () => {
    const steps = generateBFSSteps(diamond, 'A');
    const index = steps.findIndex((step) => step.message.startsWith('Discovered B'));

    expect(steps[index].edgeStatus['A>B']).toBe('active');
    expect(steps[index].traversal).toEqual({ edgeId: 'A>B', fromNodeId: 'A' });
    expect(steps[index + 1].edgeStatus['A>B']).toBe('settled');
  });

  it('never uses an edge that does not lead to a new node', () => {
    const last = generateBFSSteps(diamond, 'A').at(-1)!;
    expect(last.edgeStatus['C>D']).toBeUndefined();
  });
});
