import type { GraphData, GraphEdge, GraphNode } from '../types/graph';
import { buildAdjacency, createLabelLookup } from './adjacency';

/** A, B, … Z, then A1, B1, … Z1, A2, … — always the first label not already in use. */
export function getNextNodeLabel(nodes: GraphNode[]): string {
  const used = new Set(nodes.map((node) => node.label));

  for (let index = 0; ; index++) {
    const letter = String.fromCharCode(65 + (index % 26));
    const round = Math.floor(index / 26);
    const label = round === 0 ? letter : `${letter}${round}`;
    if (!used.has(label)) return label;
  }
}

/** Rejects self-loops and duplicates (direction matters only for directed graphs). */
export function canAddEdge(
  edges: GraphEdge[],
  directed: boolean,
  source: string,
  destination: string,
): boolean {
  if (source === destination) return false;

  return !edges.some((edge) => {
    const sameWay = edge.source === source && edge.destination === destination;
    const oppositeWay = edge.source === destination && edge.destination === source;
    return directed ? sameWay : sameWay || oppositeWay;
  });
}

/** Ids of edges that have a twin running the opposite way (A→B and B→A). */
export function findReciprocalEdgeIds(edges: GraphEdge[]): Set<string> {
  const keys = new Set(edges.map((edge) => `${edge.source}>${edge.destination}`));
  return new Set(
    edges.filter((edge) => keys.has(`${edge.destination}>${edge.source}`)).map((edge) => edge.id),
  );
}

export interface AdjacencyRow {
  id: string;
  label: string;
  neighbors: string[];
}

/** Rows for the adjacency-list panel, e.g. A: B, C (or B (4), C (2) when weighted). */
export function formatAdjacencyRows(graph: GraphData): AdjacencyRow[] {
  const adjacency = buildAdjacency(graph);
  const labelOf = createLabelLookup(graph.nodes);

  return graph.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    neighbors: (adjacency.get(node.id) ?? []).map((neighbor) =>
      graph.weighted && neighbor.weight !== undefined
        ? `${labelOf(neighbor.nodeId)} (${neighbor.weight})`
        : labelOf(neighbor.nodeId),
    ),
  }));
}
