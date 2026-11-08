import { describe, expect, it } from 'vitest';
import { documentSchema, edgeSchema, graphSchema, nodeSchema } from './schema';
import { LIMITS } from './limits';

describe('nodeSchema', () => {
  it('accepts a valid node', () => {
    const result = nodeSchema.safeParse({ id: 'n1', x: 10, y: 20, label: 'A' });
    expect(result.success).toBe(true);
  });

  it('rejects a node with no id', () => {
    const result = nodeSchema.safeParse({ x: 10, y: 20, label: 'A' });
    expect(result.success).toBe(false);
  });
});

describe('edgeSchema', () => {
  it('accepts an edge without a weight', () => {
    const result = edgeSchema.safeParse({ id: 'e1', source: 'n1', destination: 'n2' });
    expect(result.success).toBe(true);
  });

  it('rejects a weight that is not a number', () => {
    const result = edgeSchema.safeParse({ id: 'e1', source: 'n1', destination: 'n2', weight: 'heavy' });
    expect(result.success).toBe(false);
  });
});

describe('graphSchema', () => {
  const nodeA = { id: 'a', x: 10, y: 20, label: 'A' };
  const nodeB = { id: 'b', x: 50, y: 60, label: 'B' };

  it('accepts a valid graph', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: false,
      nodes: [nodeA, nodeB],
      edges: [{ id: 'e1', source: 'a', destination: 'b' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an edge pointing to a missing node', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: false,
      nodes: [nodeA],
      edges: [{ id: 'e1', source: 'a', destination: 'ghost' }],
    });
    expect(result.success).toBe(false);
  });

    it('rejects duplicate node ids', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: false,
      nodes: [nodeA, nodeA],
      edges: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an edge from a node to itself', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: false,
      nodes: [nodeA, nodeB],
      edges: [{ id: 'e1', source: 'a', destination: 'a' }],
    });
    expect(result.success).toBe(false);
  });

  it('allows A to B and B to A in a directed graph', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: false,
      nodes: [nodeA, nodeB],
      edges: [
        { id: 'e1', source: 'a', destination: 'b' },
        { id: 'e2', source: 'b', destination: 'a' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects A to B and B to A in an undirected graph', () => {
    const result = graphSchema.safeParse({
      directed: false,
      weighted: false,
      nodes: [nodeA, nodeB],
      edges: [
        { id: 'e1', source: 'a', destination: 'b' },
        { id: 'e2', source: 'b', destination: 'a' },
      ],
    });
    expect(result.success).toBe(false);
  });

    it('rejects a weighted graph with an edge that has no weight', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: true,
      nodes: [nodeA, nodeB],
      edges: [{ id: 'e1', source: 'a', destination: 'b' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a weighted graph where every edge has a weight, even a negative one', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: true,
      nodes: [nodeA, nodeB],
      edges: [{ id: 'e1', source: 'a', destination: 'b', weight: -3 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an unweighted graph that still carries leftover weights', () => {
    const result = graphSchema.safeParse({
      directed: true,
      weighted: false,
      nodes: [nodeA, nodeB],
      edges: [{ id: 'e1', source: 'a', destination: 'b', weight: 5 }],
    });
    expect(result.success).toBe(true);
  });

    it('rejects a graph with too many nodes', () => {
    const nodes = Array.from({ length: LIMITS.maxNodes + 1 }, (_, i) => ({
      id: `n${i}`,
      x: 10,
      y: 10,
      label: `N${i}`,
    }));
    const result = graphSchema.safeParse({ directed: true, weighted: false, nodes, edges: [] });
    expect(result.success).toBe(false);
  });

  it('accepts a graph with exactly the maximum number of nodes', () => {
    const nodes = Array.from({ length: LIMITS.maxNodes }, (_, i) => ({
      id: `n${i}`,
      x: 10,
      y: 10,
      label: `N${i}`,
    }));
    const result = graphSchema.safeParse({ directed: true, weighted: false, nodes, edges: [] });
    expect(result.success).toBe(true);
  });

});

describe('documentSchema', () => {
  const now = new Date().toISOString();
  const validDocument = {
    schemaVersion: 1,
    id: 'doc-1',
    name: 'My first graph',
    createdAt: now,
    updatedAt: now,
    graph: { directed: true, weighted: false, nodes: [], edges: [] },
  };

  it('accepts a valid document', () => {
    expect(documentSchema.safeParse(validDocument).success).toBe(true);
  });

  it('rejects an unknown schema version', () => {
    expect(documentSchema.safeParse({ ...validDocument, schemaVersion: 2 }).success).toBe(false);
  });

  it('rejects a name that is only spaces', () => {
    expect(documentSchema.safeParse({ ...validDocument, name: '   ' }).success).toBe(false);
  });

  it('rejects a name that is too long', () => {
    const name = 'x'.repeat(LIMITS.maxNameLength + 1);
    expect(documentSchema.safeParse({ ...validDocument, name }).success).toBe(false);
  });

  it('rejects a timestamp that is not a real date', () => {
    expect(documentSchema.safeParse({ ...validDocument, createdAt: 'yesterday' }).success).toBe(false);
  });

  it('trims the name', () => {
    const result = documentSchema.safeParse({ ...validDocument, name: '  Spaced  ' });
    expect(result.success && result.data.name).toBe('Spaced');
  });

  it('still applies the graph rules inside a document', () => {
    const broken = {
      ...validDocument,
      graph: {
        directed: true,
        weighted: false,
        nodes: [],
        edges: [{ id: 'e1', source: 'a', destination: 'b' }],
      },
    };
    expect(documentSchema.safeParse(broken).success).toBe(false);
  });
});