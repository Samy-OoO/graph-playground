import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateFloydWarshallSteps } from './floyd-warshall';

const graph = makeGraph('ABC', ['A>B:4', 'A>C:5', 'B>C:-3'], { directed: true, weighted: true });

const lastRows = (steps: ReturnType<typeof generateFloydWarshallSteps>) =>
  steps.at(-1)!.structure!.matrix!.rows.map((row) => row.cells);

describe('generateFloydWarshallSteps', () => {
  it('starts with the direct edges only', () => {
    const first = generateFloydWarshallSteps(graph)[0];
    expect(first.structure?.matrix?.rows.map((row) => row.cells)).toEqual([
      ['0', '4', '5'],
      ['∞', '0', '-3'],
      ['∞', '∞', '0'],
    ]);
  });

  it('finds the shortest distance between every pair, using a negative edge', () => {
    expect(lastRows(generateFloydWarshallSteps(graph))).toEqual([
      ['0', '4', '1'],
      ['∞', '0', '-3'],
      ['∞', '∞', '0'],
    ]);
  });

  it('lights up the new route when a distance improves', () => {
    const update = generateFloydWarshallSteps(graph).find((step) => step.message.startsWith('Update A → C'))!;
    expect(update.edgeStatus).toEqual({ 'A>B': 'active', 'B>C': 'active' });
    expect(update.nodeStatus).toEqual({ A: 'queued', C: 'queued', B: 'current' });
    expect(update.structure?.matrix?.focus).toEqual({ row: 0, column: 2, updated: true });
  });

  it('detects a negative cycle and stops', () => {
    const cycle = makeGraph('ABC', ['A>B:1', 'B>C:-3', 'C>A:1'], { directed: true, weighted: true });
    const last = generateFloydWarshallSteps(cycle).at(-1)!;
    expect(last.message).toContain('negative cycle');
    expect(last.message).not.toContain('complete');
  });
});