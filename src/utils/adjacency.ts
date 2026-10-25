import type { GraphData, GraphNode } from '../types/graph';

export interface Neighbor {
  nodeId: string;
  edgeId: string;
  weight?: number;
}

export type AdjacencyMap = Map<string, Neighbor[]>;

/**
 * Builds nodeId -> outgoing neighbors, in the order the edges were created.
 * Undirected edges are listed from both ends (sharing one edgeId).
 */
export function buildAdjacency({ nodes, edges, directed }: GraphData): AdjacencyMap {
  const adjacency: AdjacencyMap = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    adjacency.get(edge.source)?.push({ nodeId: edge.destination, edgeId: edge.id, weight: edge.weight });
    if (!directed) {
      adjacency.get(edge.destination)?.push({ nodeId: edge.source, edgeId: edge.id, weight: edge.weight });
    }
  }

  return adjacency;
}

/** Returns a function that turns a node id into its label. */
export function createLabelLookup(nodes: GraphNode[]): (nodeId: string) => string {
  const labels = new Map(nodes.map((node) => [node.id, node.label]));
  return (nodeId) => labels.get(nodeId) ?? nodeId;
}
