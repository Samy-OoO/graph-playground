import type { GraphEdge, GraphNode } from '../types/graph';
import { canAddEdge, getNextNodeLabel } from '../utils/graph';

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed: boolean;
  weighted: boolean;
  /**
   * Bumped whenever the graph's structure changes (nodes/edges added or removed, direction
   * toggled). Algorithm runs are tied to a version, so editing the graph invalidates them.
   * Moving a node does not change it.
   */
  version: number;
}

export const initialGraphState: GraphState = {
  nodes: [],
  edges: [],
  directed: true,
  weighted: false,
  version: 0,
};

// Ids come in with the action so the reducer stays pure.
export type GraphAction =
  | { type: 'node/add'; id: string; x: number; y: number }
  | { type: 'node/move'; id: string; x: number; y: number }
  | { type: 'node/delete'; id: string }
  | { type: 'edge/add'; id: string; source: string; destination: string; weight?: number }
  | { type: 'edge/delete'; id: string }
  | { type: 'settings/toggleDirected' }
  | { type: 'settings/toggleWeighted' }
  | { type: 'graph/replace'; nodes: GraphNode[]; edges: GraphEdge[]; directed: boolean; weighted: boolean }
  | { type: 'graph/clear' };

export function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'node/add': {
      const node: GraphNode = { id: action.id, x: action.x, y: action.y, label: getNextNodeLabel(state.nodes) };
      return { ...state, nodes: [...state.nodes, node], version: state.version + 1 };
    }

    case 'node/move':
      return {
        ...state,
        nodes: state.nodes.map((node) => (node.id === action.id ? { ...node, x: action.x, y: action.y } : node)),
      };

    case 'node/delete':
      return {
        ...state,
        nodes: state.nodes.filter((node) => node.id !== action.id),
        edges: state.edges.filter((edge) => edge.source !== action.id && edge.destination !== action.id),
        version: state.version + 1,
      };

    case 'edge/add': {
      if (!canAddEdge(state.edges, state.directed, action.source, action.destination)) return state;
      const edge: GraphEdge = {
        id: action.id,
        source: action.source,
        destination: action.destination,
        ...(state.weighted && { weight: action.weight ?? 1 }),
      };
      return { ...state, edges: [...state.edges, edge], version: state.version + 1 };
    }

    case 'edge/delete':
      return { ...state, edges: state.edges.filter((edge) => edge.id !== action.id), version: state.version + 1 };

    case 'settings/toggleDirected':
      return { ...state, directed: !state.directed, version: state.version + 1 };

    case 'settings/toggleWeighted': {
      const weighted = !state.weighted;
      return {
        ...state,
        weighted,
        // Edges drawn while unweighted get a default weight of 1 the moment weights are switched on.
        edges: weighted ? state.edges.map((edge) => ({ ...edge, weight: edge.weight ?? 1 })) : state.edges,
      };
    }

    case 'graph/replace':
      return {
        nodes: action.nodes,
        edges: action.edges,
        directed: action.directed,
        weighted: action.weighted,
        version: state.version + 1,
      };

    case 'graph/clear':
      return { ...state, nodes: [], edges: [], version: state.version + 1 };
  }
}
