import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateEulerSteps } from './eulerian';

const undirected = { directed: false };
const directed = { directed: true };

const triangle = makeGraph('ABC', ['A>B', 'B>C', 'C>A'], undirected);
const line = makeGraph('ABC', ['A>B', 'B>C'], undirected);

const table = (step: ReturnType<typeof generateEulerSteps>[number]) =>
  step.structure!.matrix!.rows.map((row) => row.cells);

describe('generateEulerPathSteps', () => {
  it('shows Degree and Unused for an undirected graph', () => {
    const first = generateEulerSteps(triangle)[0];
    expect(first.structure?.matrix?.columnLabels).toEqual(['Degree', 'Unused']);
    expect(table(first)).toEqual([['2', '2'], ['2', '2'], ['2', '2']]);
  });

  it('highlights odd-degree nodes in the first frame', () => {
    expect(generateEulerSteps(line)[0].nodeStatus).toEqual({ A: 'queued', C: 'queued' });
  });

  it('finds a circuit when every degree is even', () => {
    const steps = generateEulerSteps(triangle);
    expect(steps[1].nodeStatus).toEqual({ A: 'current' });
    expect(steps.at(-1)!.message).toContain('Eulerian circuit: A → B → C → A.');
  });

  it('finds a path between the two odd nodes', () => {
    const steps = generateEulerSteps(line);
    expect(steps[1].nodeStatus).toEqual({ A: 'current', C: 'queued' });
    expect(steps.at(-1)!.message).toContain('Eulerian path: A → B → C.');
  });

  it('gives up when more than two nodes have odd degree', () => {
    const k4 = makeGraph('ABCD', ['A>B', 'A>C', 'A>D', 'B>C', 'B>D', 'C>D'], undirected);
    const steps = generateEulerSteps(k4);
    expect(steps).toHaveLength(2);
    expect(steps[1].message).toContain('4 nodes have odd degree');
  });

  it('finds a directed path from the out-heavy node to the in-heavy node', () => {
    const steps = generateEulerSteps(makeGraph('ABC', ['A>B', 'B>C'], directed));
    expect(steps.at(-1)!.message).toContain('Eulerian path: A → B → C.');
  });

  it('shows an edge being walked, the stack and the Unused counts', () => {
    const walk = generateEulerSteps(triangle).find((step) => step.message.startsWith('Walk A → B'))!;
    expect(walk.edgeStatus).toEqual({ 'A>B': 'active' });
    expect(walk.structure?.items).toEqual(['A', 'B']);
    expect(table(walk).map((cells) => cells[1])).toEqual(['1', '1', '2']);
  });

  it('lets the stack repeat a node when the walk comes back to it', () => {
    const back = generateEulerSteps(triangle).find((step) => step.message.startsWith('Walk C → A'))!;
    expect(back.structure?.items).toEqual(['A', 'B', 'C', 'A']);
  });

  it('reports edges that cannot be reached from the start', () => {
    const twoTriangles = makeGraph('ABCDEF', ['A>B', 'B>C', 'C>A', 'D>E', 'E>F', 'F>D'], undirected);
    const last = generateEulerSteps(twoTriangles).at(-1)!;
    expect(last.message).toContain('Only 3 of 6 edges');
    expect(last.edgeStatus).toMatchObject({ 'A>B': 'settled', 'D>E': 'skipped' });
  });
});