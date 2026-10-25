// Core graph types. Named GraphNode / GraphEdge so they never shadow the DOM's global `Node`.

export type Point = { x: number; y: number };

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  label: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  destination: string;
  weight?: number;
};

/** Everything an algorithm needs to know about a graph. */
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed: boolean;
  weighted: boolean;
};
