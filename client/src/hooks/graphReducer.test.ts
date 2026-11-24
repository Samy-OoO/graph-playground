import { describe, expect, it } from 'vitest';
import { graphReducer, initialGraphState } from './graphReducer';
import type { GraphAction, GraphState } from './graphReducer';
import { LIMITS } from '@graph-playground/shared';

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

describe('graph size limits', () => {
  const manyNodes = Array.from({ length: LIMITS.maxNodes }, (_, i) => ({ id: `n${i}`, x: 10, y: 10, label: `N${i}` }));

  it('ignores a new node once the node limit is reached', () => {
    const full = run([{ type: 'graph/replace', nodes: manyNodes, edges: [], directed: true, weighted: false }]);
    const after = graphReducer(full, addNode('one-too-many'));
    expect(after.nodes).toHaveLength(LIMITS.maxNodes);
  });

  it('still accepts a node just below the limit', () => {
    const almost = run([{ type: 'graph/replace', nodes: manyNodes.slice(1), edges: [], directed: true, weighted: false }]);
    expect(graphReducer(almost, addNode('last-one')).nodes).toHaveLength(LIMITS.maxNodes);
  });

  it('ignores a new edge once the edge limit is reached', () => {
    // The first maxEdges pairs of nodes, so n198 -> n199 is still free.
    const edges = [];
    for (let i = 0; i < manyNodes.length && edges.length < LIMITS.maxEdges; i++) {
      for (let j = i + 1; j < manyNodes.length && edges.length < LIMITS.maxEdges; j++) {
        edges.push({ id: `e${i}-${j}`, source: `n${i}`, destination: `n${j}` });
      }
    }
    const full = run([{ type: 'graph/replace', nodes: manyNodes, edges, directed: true, weighted: false }]);
    const after = graphReducer(full, addEdge('one-too-many', 'n198', 'n199'));
    expect(after.edges).toHaveLength(LIMITS.maxEdges);
  });
});