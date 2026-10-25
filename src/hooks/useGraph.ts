import { useCallback, useMemo, useReducer } from 'react';
import { SAMPLE_GRAPH } from '../data/sampleGraph';
import { createId } from '../utils/id';
import { graphReducer, initialGraphState } from './graphReducer';

/** Owns the graph data (nodes, edges, settings) and every way of changing it. */
export function useGraph() {
  const [state, dispatch] = useReducer(graphReducer, initialGraphState);
  const { nodes, edges, directed, weighted, version } = state;

  const addNode = useCallback((x: number, y: number) => {
    dispatch({ type: 'node/add', id: createId(), x, y });
  }, []);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'node/move', id, x, y });
  }, []);

  const deleteNode = useCallback((id: string) => {
    dispatch({ type: 'node/delete', id });
  }, []);

  const addEdge = useCallback((source: string, destination: string, weight?: number) => {
    dispatch({ type: 'edge/add', id: createId(), source, destination, weight });
  }, []);

  const deleteEdge = useCallback((id: string) => {
    dispatch({ type: 'edge/delete', id });
  }, []);

  const toggleDirected = useCallback(() => dispatch({ type: 'settings/toggleDirected' }), []);
  const toggleWeighted = useCallback(() => dispatch({ type: 'settings/toggleWeighted' }), []);
  const loadSample = useCallback(() => dispatch({ type: 'graph/replace', ...SAMPLE_GRAPH }), []);
  const clear = useCallback(() => dispatch({ type: 'graph/clear' }), []);

  // Stable object for anything that just needs to read the graph (algorithms, adjacency list).
  const data = useMemo(() => ({ nodes, edges, directed, weighted }), [nodes, edges, directed, weighted]);

  return {
    nodes,
    edges,
    directed,
    weighted,
    version,
    data,
    addNode,
    moveNode,
    deleteNode,
    addEdge,
    deleteEdge,
    toggleDirected,
    toggleWeighted,
    loadSample,
    clear,
  };
}

export type GraphApi = ReturnType<typeof useGraph>;
