import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateTopoSortSteps } from './topo-sort';

const diamond = makeGraph('ABCD', ['A>B', 'A>C', 'B>D', 'C>D'], { directed: true });

const table = (step: ReturnType<typeof generateTopoSortSteps>[number]) =>
  step.structure!.matrix!.rows.map((row) => row.cells);

describe('generateTopologicalSortSteps', () => {
  it('asks for a directed graph', () => {
    const steps = generateTopoSortSteps(makeGraph('AB', ['A>B'], { directed: false }));
    expect(steps).toHaveLength(1);
    expect(steps[0].message).toContain('directed');
  });

  it('starts by counting in-degrees', () => {
    const first = generateTopoSortSteps(diamond)[0];
    expect(table(first)).toEqual([['0', '–'], ['1', '–'], ['1', '–'], ['2', '–']]);
  });

  it('finds a valid order and fills in the Order column', () => {
    const last = generateTopoSortSteps(diamond).at(-1)!;
    expect(last.message).toContain('A → B → C → D');
    expect(table(last).map((cells) => cells[1])).toEqual(['1', '2', '3', '4']);
  });

  it('only queues a node once ALL its incoming edges are gone', () => {
    const steps = generateTopoSortSteps(diamond);
    const firstIntoD = steps.find((step) => step.message.startsWith('Remove edge B → D'))!;
    expect(firstIntoD.message).toContain('2 → 1');
    expect(firstIntoD.message).not.toContain('ready');
    const secondIntoD = steps.find((step) => step.message.startsWith('Remove edge C → D'))!;
    expect(secondIntoD.message).toContain('is ready');
  });

  it('detects a cycle behind a valid start', () => {
    const cycle = makeGraph('ABC', ['A>B', 'B>C', 'C>B'], { directed: true });
    const last = generateTopoSortSteps(cycle).at(-1)!;
    expect(last.message).toContain('only 1 of 3 nodes');
    expect(last.edgeStatus).toEqual({ 'A>B': 'settled', 'B>C': 'skipped', 'C>B': 'skipped' });
  });
});