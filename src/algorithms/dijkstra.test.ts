// src/algorithms/dijkstra.test.ts
import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateDijkstraSteps } from './dijkstra';

const weighted = { directed: true, weighted: true };

// A→B 5, A→C 1, C→B 2, B→D 1, C→D 5   (shortest: A 0, C 1, B 3, D 4; no ties anywhere)
const graph = makeGraph('ABCD', ['A>B:5', 'A>C:1', 'C>B:2', 'B>D:1', 'C>D:5'], weighted);

const messages = (steps: ReturnType<typeof generateDijkstraSteps>) => steps.map((step) => step.message);
const sorted = (items: string[] | undefined) => [...(items ?? [])].sort();

describe('generateDijkstraSteps', () => {
  it('returns nothing for an unknown start node', () => {
    expect(generateDijkstraSteps(graph, 'Z')).toEqual([]);
  });

  describe('the opening frame', () => {
    it('starts at distance 0 with only the start node in the heap', () => {
      const first = generateDijkstraSteps(graph, 'A')[0];
      expect(first.message).toContain('Start at A with distance 0');
      expect(first.structure?.title).toBe('Priority queue');
      expect(first.structure?.items).toEqual(['A (0)']);
      expect(first.nodeStatus).toEqual({ A: 'queued' });
      expect(first.edgeStatus).toEqual({});
      expect(first.traversal).toBeNull();
    });
  });

  describe('settling nodes', () => {
    it('takes the closest node out of the heap and settles it', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const takeC = steps.find((step) => step.message.startsWith('Take C'))!;
      expect(takeC.message).toBe('Take C from the Min-Heap and settle it at the distance 1.');
      expect(takeC.nodeStatus).toMatchObject({ C: 'current', A: 'visited' });
    });

    it('settles nodes in order of distance, not in order of discovery', () => {
      const taken = messages(generateDijkstraSteps(graph, 'A'))
        .filter((message) => message.startsWith('Take '))
        .map((message) => message.charAt(5));
      expect(taken).toEqual(['A', 'C', 'B', 'D']);
    });

    it('turns the edge that reached a node into a settled edge once that node is settled', () => {
      const steps = generateDijkstraSteps(graph, 'A');

      const relaxAC = steps.find((step) => step.message.startsWith('Relax A → C'))!;
      expect(relaxAC.edgeStatus['A>C']).toBe('active');

      const takeC = steps.find((step) => step.message.startsWith('Take C'))!;
      expect(takeC.edgeStatus['A>C']).toBe('settled');
    });
  });

  describe('relaxing edges', () => {
    it('improves a distance and highlights the edge', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const relax = steps.find((step) => step.message.startsWith('Relax A → B'))!;

      expect(relax.message).toBe('Relax A → B: improve the distance from ∞ to 5.');
      expect(relax.edgeStatus['A>B']).toBe('active');
      expect(relax.traversal).toEqual({ edgeId: 'A>B', fromNodeId: 'A' });
      expect(relax.nodeStatus).toMatchObject({ A: 'current', B: 'queued' });
      expect(sorted(relax.structure?.items)).toEqual(['B (5)']);
    });

    it('finds a shorter route to a node that already had a distance', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const better = steps.find((step) => step.message.startsWith('Relax C → B'))!;

      expect(better.message).toBe('Relax C → B: improve the distance from 5 to 3.');
      expect(sorted(better.structure?.items)).toEqual(['B (3)', 'B (5)']);
    });

    it('keeps the old distance when the new route is not better', () => {
      const line = makeGraph('ABC', ['A>B:1', 'A>C:3', 'B>C:5'], weighted);
      const keep = generateDijkstraSteps(line, 'A').find((step) => step.message.startsWith('Keep'))!;

      expect(keep.message).toBe('Keep the distance to C at 3; 6 is not better.');
      expect(keep.edgeStatus['B>C']).toBe('skipped');
      expect(keep.traversal).toEqual({ edgeId: 'B>C', fromNodeId: 'B' });
    });

    it('keeps the old distance when the new route is exactly as long', () => {
      const tie = makeGraph('ABC', ['A>B:2', 'A>C:1', 'C>B:1'], weighted);
      const steps = generateDijkstraSteps(tie, 'A');
      const keep = steps.find((step) => step.message.startsWith('Keep'))!;

      expect(keep.message).toBe('Keep the distance to B at 2; 2 is not better.');
      expect(keep.edgeStatus['C>B']).toBe('skipped');
      expect(steps.at(-1)!.edgeStatus).toEqual({ 'A>C': 'settled', 'A>B': 'settled' });
    });

    it('skips an edge that leads back to a settled node', () => {
      const undirected = makeGraph('AB', ['A>B:1'], { directed: false, weighted: true });
      const steps = generateDijkstraSteps(undirected, 'A');

      const back = steps.find((step) => step.message.startsWith('B ↔ A'))!;
      expect(back.message).toBe('B ↔ A: A is already settled, so skip this edge.');
      // The edge that reached B is already a settled tree edge, so it stays settled.
      expect(back.edgeStatus['A>B']).toBe('settled');
    });
  });

  describe('outdated heap entries', () => {
    it('skips entries that were replaced by a shorter distance', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const outdated = messages(steps).filter((message) => message.startsWith('Skipping the outdated'));

      expect(outdated).toEqual([
        'Skipping the outdated queue entry for B',
        'Skipping the outdated queue entry for D',
      ]);
    });

    it('does not highlight any node as current on a skipped entry', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const outdated = steps.find((step) => step.message.startsWith('Skipping the outdated'))!;
      expect(Object.values(outdated.nodeStatus)).not.toContain('current');
    });
  });

  describe('the final frame', () => {
    it('reports the shortest distance to every node', () => {
      const last = generateDijkstraSteps(graph, 'A').at(-1)!;
      expect(last.message).toBe('Dijkstra complete. Final distances: A: 0, B: 3, C: 1, D: 4.');
    });

    it('keeps exactly the shortest-path edges as settled', () => {
      const last = generateDijkstraSteps(graph, 'A').at(-1)!;
      expect(last.edgeStatus).toEqual({ 'A>C': 'settled', 'C>B': 'settled', 'B>D': 'settled' });
    });

    it('marks every reachable node as visited and leaves the heap empty', () => {
      const last = generateDijkstraSteps(graph, 'A').at(-1)!;
      expect(last.nodeStatus).toEqual({ A: 'visited', B: 'visited', C: 'visited', D: 'visited' });
      expect(last.structure?.items).toEqual([]);
    });

    it('lists unreachable nodes at infinity and counts them', () => {
      const one = makeGraph('ABC', ['A>B:1'], weighted);
      const lastOne = generateDijkstraSteps(one, 'A').at(-1)!;
      expect(lastOne.message).toBe('Dijkstra complete. Final distances: A: 0, B: 1, C: ∞. 1 node not reachable from A.');
      expect(lastOne.nodeStatus).toEqual({ A: 'visited', B: 'visited' });

      const two = makeGraph('ABCD', ['A>B:1'], weighted);
      expect(generateDijkstraSteps(two, 'A').at(-1)!.message).toContain('2 nodes not reachable from A.');
    });
  });

  describe('graph types', () => {
    it('follows edge directions in a directed graph', () => {
      const last = generateDijkstraSteps(graph, 'D').at(-1)!;
      expect(last.message).toContain('A: ∞, B: ∞, C: ∞, D: 0');
      expect(last.message).toContain('3 nodes not reachable from D.');
    });

    it('walks edges both ways in an undirected graph and uses ↔', () => {
      const undirected = makeGraph('ABC', ['A>B:2', 'B>C:3'], { directed: false, weighted: true });
      const steps = generateDijkstraSteps(undirected, 'C');

      expect(steps.at(-1)!.message).toContain('A: 5, B: 3, C: 0');
      expect(messages(steps).some((message) => message.startsWith('Relax C ↔ B'))).toBe(true);
    });

    it('counts every edge as 1 when the graph is unweighted', () => {
      const plain = makeGraph('ABC', ['A>B', 'B>C']);
      expect(generateDijkstraSteps(plain, 'A').at(-1)!.message).toContain('A: 0, B: 1, C: 2');
    });

    it('ignores stored weights when the graph is not weighted', () => {
      const ignored = makeGraph('AB', ['A>B:9'], { directed: true, weighted: false });
      expect(generateDijkstraSteps(ignored, 'A').at(-1)!.message).toContain('A: 0, B: 1');
    });

    it('allows zero-weight edges', () => {
      const zero = makeGraph('ABC', ['A>B:0', 'B>C:2'], weighted);
      expect(generateDijkstraSteps(zero, 'A').at(-1)!.message).toContain('A: 0, B: 0, C: 2');
    });

    it('rounds distances for display', () => {
      const decimals = makeGraph('ABC', ['A>B:0.1', 'B>C:0.2'], weighted);
      expect(generateDijkstraSteps(decimals, 'A').at(-1)!.message).toContain('C: 0.3');
    });
  });

  describe('invalid weights', () => {
    it('refuses negative weights with a single explanatory step', () => {
      const negative = makeGraph('AB', ['A>B:-2'], weighted);
      const steps = generateDijkstraSteps(negative, 'A');

      expect(steps).toHaveLength(1);
      expect(steps[0].message).toBe("Dijkstra can't use negative edge weights. Edge A → B has weight -2.");
      expect(steps[0].structure).toBeNull();
      expect(steps[0].nodeStatus).toEqual({});
      expect(steps[0].edgeStatus).toEqual({});
    });

    it('uses ↔ in the message for an undirected graph', () => {
      const negative = makeGraph('AB', ['A>B:-1'], { directed: false, weighted: true });
      expect(generateDijkstraSteps(negative, 'A')[0].message).toContain('Edge A ↔ B has weight -1.');
    });

    it('refuses infinite weights', () => {
      const infinite = makeGraph('AB', ['A>B:Infinity'], weighted);
      const steps = generateDijkstraSteps(infinite, 'A');

      expect(steps).toHaveLength(1);
      expect(steps[0].message).toBe('Dijkstra requires finite edge weights. Edge A → B has infinite weight.');
    });

    it('ignores negative weights when the graph is not weighted', () => {
      const unweighted = makeGraph('AB', ['A>B:-5'], { directed: true, weighted: false });
      const steps = generateDijkstraSteps(unweighted, 'A');

      expect(steps.length).toBeGreaterThan(1);
      expect(steps.at(-1)!.message).toContain('A: 0, B: 1');
    });
  });
});