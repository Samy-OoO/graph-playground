import { describe, expect, it } from 'vitest';
import { makeGraph } from '../test/makeGraph';
import { generateDijkstraSteps } from './dijkstra';

const weighted = { directed: true, weighted: true };

// A→B 5, A→C 1, C→B 2, B→D 1, C→D 5   (shortest: A 0, C 1, B 3, D 4; no ties anywhere)
const graph = makeGraph('ABCD', ['A>B:5', 'A>C:1', 'C>B:2', 'B>D:1', 'C>D:5'], weighted);

const messages = (steps: ReturnType<typeof generateDijkstraSteps>) => steps.map((step) => step.message);

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

      const relaxA = steps.find((step) => step.message.startsWith('Relax the edges from A'))!;
      expect(relaxA.edgeStatus['A>C']).toBe('active');

      const takeC = steps.find((step) => step.message.startsWith('Take C'))!;
      expect(takeC.edgeStatus['A>C']).toBe('settled');
    });
  });

  describe('relaxing edges', () => {
    it('relaxes every outgoing edge of a node in a single frame', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const relax = steps.find((step) => step.message.startsWith('Relax the edges from A'))!;

      expect(relax.message).toBe('Relax the edges from A. Improved: B ∞ → 5, C ∞ → 1.');
      expect(relax.edgeStatus).toEqual({ 'A>B': 'active', 'A>C': 'active' });
      expect(relax.nodeStatus).toEqual({ A: 'current', B: 'queued', C: 'queued' });
      expect(relax.traversal).toBeNull();
      expect(relax.structure?.items).toEqual(['C (1)', 'B (5)']);
    });

    it('finds a shorter route to a node that already had a distance', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const fromC = steps.find((step) => step.message.startsWith('Relax the edges from C'))!;

      expect(fromC.message).toBe('Relax the edges from C. Improved: B 5 → 3, D ∞ → 6.');
      expect(fromC.edgeStatus).toEqual({ 'A>C': 'settled', 'C>B': 'active', 'C>D': 'active' });
      // The replaced entry B (5) is outdated and no longer shown.
      expect(fromC.structure?.items).toEqual(['B (3)', 'D (6)']);
    });

    it('keeps the old distance when the new route is not better', () => {
      const line = makeGraph('ABC', ['A>B:1', 'A>C:3', 'B>C:5'], weighted);
      const fromB = generateDijkstraSteps(line, 'A').find((step) => step.message.startsWith('Relax the edges from B'))!;

      expect(fromB.message).toBe('Relax the edges from B. No improvement: C stays at 3 (6 is not better).');
      expect(fromB.edgeStatus).toEqual({ 'A>B': 'settled', 'B>C': 'skipped' });
    });

    it('keeps the old distance when the new route is exactly as long', () => {
      const tie = makeGraph('ABC', ['A>B:2', 'A>C:1', 'C>B:1'], weighted);
      const steps = generateDijkstraSteps(tie, 'A');
      const fromC = steps.find((step) => step.message.startsWith('Relax the edges from C'))!;

      expect(fromC.message).toBe('Relax the edges from C. No improvement: B stays at 2 (2 is not better).');
      expect(fromC.edgeStatus['C>B']).toBe('skipped');
      expect(steps.at(-1)!.edgeStatus).toEqual({ 'A>C': 'settled', 'A>B': 'settled' });
    });

    it('shows improved and unimproved edges together in the same frame', () => {
      const mixed = makeGraph('ABCD', ['A>B:2', 'A>C:1', 'C>B:5', 'C>D:1'], weighted);
      const fromC = generateDijkstraSteps(mixed, 'A').find((step) => step.message.startsWith('Relax the edges from C'))!;

      expect(fromC.message).toBe(
        'Relax the edges from C. Improved: D ∞ → 2. No improvement: B stays at 2 (6 is not better).',
      );
      expect(fromC.edgeStatus).toEqual({ 'A>C': 'settled', 'C>D': 'active', 'C>B': 'skipped' });
      expect(fromC.nodeStatus).toEqual({ A: 'visited', C: 'current', B: 'queued', D: 'queued' });
    });

    it('leaves out edges that lead back to settled nodes', () => {
      const undirected = makeGraph('AB', ['A>B:1'], { directed: false, weighted: true });
      const steps = generateDijkstraSteps(undirected, 'A');

      expect(messages(steps).some((message) => message.startsWith('Relax the edges from A'))).toBe(true);
      expect(messages(steps).some((message) => message.startsWith('Relax the edges from B'))).toBe(false);
      // After B is taken there is nothing left to relax, so the next frame is the final one.
      const takeB = steps.findIndex((step) => step.message.startsWith('Take B'));
      expect(steps[takeB + 1].message).toContain('Dijkstra complete');
    });

    it('does not draw a frame for a node without outgoing edges to unsettled nodes', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const takeD = steps.findIndex((step) => step.message.startsWith('Take D'));
      expect(steps[takeD + 1].message).toContain('Dijkstra complete');
    });
  });

  describe('the heap panel', () => {
    it('never mentions outdated entries', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      expect(messages(steps).some((message) => message.toLowerCase().includes('outdated'))).toBe(false);
    });

    it('lists every queued node once, closest first', () => {
      for (const step of generateDijkstraSteps(graph, 'A')) {
        const items = step.structure!.items;
        const labels = items.map((item) => item.split(' ')[0]);
        const distances = items.map((item) => Number(/\((.+)\)$/.exec(item)![1]));

        expect(new Set(labels).size).toBe(labels.length);
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
      }
    });

    it('shows the closest node first even when it was queued after a farther one', () => {
      const fan = makeGraph('ABCD', ['A>B:5', 'A>C:1', 'A>D:3'], weighted);
      const fromA = generateDijkstraSteps(fan, 'A').find((step) => step.message.startsWith('Relax the edges from A'))!;
      expect(fromA.structure?.items).toEqual(['C (1)', 'D (3)', 'B (5)']);
    });

    it('draws at most one frame per node plus the opening and closing frames', () => {
      const steps = generateDijkstraSteps(graph, 'A');
      const takes = messages(steps).filter((message) => message.startsWith('Take ')).length;
      const relaxes = messages(steps).filter((message) => message.startsWith('Relax the edges')).length;

      expect(takes).toBe(4);
      expect(relaxes).toBe(3);
      expect(steps).toHaveLength(1 + takes + relaxes + 1);
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

    it('walks edges both ways in an undirected graph', () => {
      const undirected = makeGraph('ABC', ['A>B:2', 'B>C:3'], { directed: false, weighted: true });
      const steps = generateDijkstraSteps(undirected, 'C');

      expect(steps.at(-1)!.message).toContain('A: 5, B: 3, C: 0');
      expect(messages(steps)).toContain('Relax the edges from C. Improved: B ∞ → 3.');
      expect(messages(steps)).toContain('Relax the edges from B. Improved: A ∞ → 5.');
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