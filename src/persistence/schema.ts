import { z } from 'zod';
import { LIMITS } from './limits';

export const CURRENT_SCHEMA_VERSION = 1;

export const nodeSchema = z.object({
    id: z.string().min(1),
    x: z.number(),
    y: z.number(),
    label: z.string().min(1),
});

export const edgeSchema = z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    destination: z.string().min(1),
    weight: z.number().optional(),
});

export const graphSchema = z.object({
    directed: z.boolean(),
    weighted: z.boolean(),
    nodes: z.array(nodeSchema).max(LIMITS.maxNodes, `A graph can have at most ${LIMITS.maxNodes} nodes`),
    edges: z.array(edgeSchema).max(LIMITS.maxEdges, `A graph can have at most ${LIMITS.maxEdges} edges`),
})
.superRefine((graph, ctx) => {

    // Rule 1: Ids must be unique.
    const nodeIds = new Set<string>();
    graph.nodes.forEach((node, index) => {
        if (nodeIds.has(node.id)) {
            ctx.addIssue({
                code: 'custom',
                message: `Duplicate node id "${node.id}"`,
                path: ['nodes', index, 'id'],
            });
        }
        nodeIds.add(node.id);
    });

    const edgeIds = new Set<string>();
    graph.edges.forEach((edge, index) => {
        if (edgeIds.has(edge.id)) {
            ctx.addIssue({
                code: 'custom',
                message: `Duplicate edge id "${edge.id}"`,
                path: ['edges', index, 'id'],
            });
        }
        edgeIds.add(edge.id);
    });


    // Rule 2: Every edge must be a legal connection.
    const seenConnections = new Set<string>();
    graph.edges.forEach((edge, index) => {
        if (!nodeIds.has(edge.source)) {
            ctx.addIssue({
                code: 'custom',
                message: 'Edge points to a node that does not exist (source)',
                path: ['edges', index, 'source'],
            });
        }
        if (!nodeIds.has(edge.destination)) {
            ctx.addIssue({
                code: 'custom',
                message: 'Edge points to a node that does not exist (destination)',
                path: ['edges', index, 'destination'],
            });
        }
        if (edge.source === edge.destination) {
            ctx.addIssue({
                code: 'custom',
                message: 'An edge cannot connect a node to itself (self-loop)',
                path: ['edges', index],
            })
        }


        // A weighted graph needs a weight on every edge.
        if (graph.weighted && edge.weight === undefined) {
            ctx.addIssue({
                code: 'custom',
                message: 'Every edge needs a weight because the graph is weighted',
                path: ['edge', index, 'weight'],
            });
        }


        // In an undirected graph A-B and B-A are the same edge, so sort the pair first.
        const pair = graph.directed
            ? [edge.source, edge.destination]
            : [edge.source, edge.destination].sort();
        const key = JSON.stringify(pair);

        if (seenConnections.has(key)) {
            ctx.addIssue({
                code: 'custom',
                message: 'This connection already exists',
                path: ['edges', index],
            });
        }
        seenConnections.add(key);
    });
});


export const documentSchema = z.object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().trim().min(1).max(LIMITS.maxNameLength),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    graph: graphSchema,
});

export type GraphDocument = z.infer<typeof documentSchema>;