import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateBellmanFordSteps } from './bellman-ford';

const graph = makeGraph('ABC', ['A>B:4', 'A>C:5', 'B>C:-3'], { directed: true, weighted: true });

describe('generateBellmanFordSteps', () => {
  it('returns nothing for an unknown start node', () => {
    expect(generateBellmanFordSteps(graph, 'Z')).toEqual([]);
  });

  it('finds shortest distances, including through a negative edge', () => {
    const last = generateBellmanFordSteps(graph, 'A').at(-1)!;
    expect(last.message).toContain('A: 0, B: 4, C: 1');
  });

  it('detects a negative cycle', () => {
    const cycle = makeGraph('ABC', ['A>B:1', 'B>C:-3', 'C>A:1'], { directed: true, weighted: true });
    const last = generateBellmanFordSteps(cycle, 'A').at(-1)!;
    expect(last.message).toContain('negative cycle');
  });
});