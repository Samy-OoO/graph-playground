import { describe, expect, it } from 'vitest';
import { graphReducer, initialGraphState } from './graphReducer';
import type { GraphAction, GraphState } from './graphReducer';

function run(actions: GraphAction[], from: GraphState = initialGraphState): GraphState {
  return actions.reduce(graphReducer, from);
}

const addNode = (id: string): GraphAction => ({ type: 'node/add', id, x: 100, y: 100 });
const addEdge = (id: string, source: string, destination: string, weight?: number): GraphAction => ({
  type: 'edge/add',
  id,
  source,
  destination,
  weight,
});

describe('graphReducer', () => {
  it('labels new nodes A, B, C …', () => {
    const state = run([addNode('1'), addNode('2'), addNode('3')]);
    expect(state.nodes.map((node) => node.label)).toEqual(['A', 'B', 'C']);
  });

  it('keeps labels unique past Z', () => {
    const state = run(Array.from({ length: 60 }, (_, i) => addNode(`n${i}`)));
    const labels = state.nodes.map((node) => node.label);

    expect(new Set(labels).size).toBe(60);
    expect(labels[25]).toBe('Z');
    expect(labels[26]).toBe('A1');
  });

  it('reuses the first free label after a node is deleted', () => {
    const state = run([addNode('1'), addNode('2'), { type: 'node/delete', id: '1' }, addNode('3')]);
    expect(state.nodes.map((node) => node.label)).toEqual(['B', 'A']);
  });

  it('removes a deleted node’s edges', () => {
    const state = run([addNode('1'), addNode('2'), addNode('3'), addEdge('e1', '1', '2'), addEdge('e2', '2', '3'), { type: 'node/delete', id: '2' }]);
    expect(state.edges).toEqual([]);
  });

  it('rejects self-loops and duplicate edges', () => {
    const state = run([addNode('1'), addNode('2'), addEdge('e1', '1', '1'), addEdge('e2', '1', '2'), addEdge('e3', '1', '2')]);
    expect(state.edges.map((edge) => edge.id)).toEqual(['e2']);
  });

  it('treats A→B and B→A as different edges only when directed', () => {
    const base = [addNode('1'), addNode('2'), addEdge('e1', '1', '2')];

    expect(run([...base, addEdge('e2', '2', '1')]).edges).toHaveLength(2);

    const undirected = run([{ type: 'settings/toggleDirected' }, ...base, addEdge('e2', '2', '1')]);
    expect(undirected.edges).toHaveLength(1);
  });

  it('gives existing edges weight 1 when weights are switched on, and stores weights on new edges', () => {
    const state = run([addNode('1'), addNode('2'), addEdge('e1', '1', '2'), { type: 'settings/toggleWeighted' }, addEdge('e2', '2', '1', 7)]);
    expect(state.edges.map((edge) => edge.weight)).toEqual([1, 7]);
  });

  it('bumps the version on structural changes but not when a node moves', () => {
    const afterAdd = run([addNode('1')]);
    const afterMove = graphReducer(afterAdd, { type: 'node/move', id: '1', x: 5, y: 5 });

    expect(afterAdd.version).toBeGreaterThan(initialGraphState.version);
    expect(afterMove.version).toBe(afterAdd.version);
    expect(afterMove.nodes[0]).toMatchObject({ x: 5, y: 5 });
  });
});
