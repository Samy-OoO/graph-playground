import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from "../db/connection";
import { graphs, type GraphRow } from "../db/schema";
import type { GraphRepository } from "./graphRepository";
import type { GraphSummary, StoredGraph } from "./types";
import { CURRENT_SCHEMA_VERSION } from '@graph-playground/shared';

function toStoredGraph(row: GraphRow): StoredGraph {
    return {
        id: row.id,
        name: row.name,
        graph: row.data, 
        schemaVersion: row.schemaVersion,
        revision: row.revision,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}


function toSummary(row: GraphRow): GraphSummary {
    return {
        id: row.id,
        name: row.name,
        revision: row.revision, 
        createdAt: row.createdAt, 
        updatedAt: row.updatedAt, 
        nodeCount: row.data.nodes.length,
        edgeCount: row.data.edges.length, 
    }
}


// The clock is a parameter so tests can control time instead of waiting for it.
export function createGraphRepository(db: Db, clock: () => string = () => new Date().toISOString()): GraphRepository {
    async function get(ownerId: string, id: string) {
        const row = db
            .select()
            .from(graphs)
            .where(and(eq(graphs.id, id), eq(graphs.ownerId, ownerId)))
            .get();
        return row ? toStoredGraph(row) : null;
    }


    return {
        async list(ownerId) {
            const rows = db
                .select()
                .from(graphs)
                .where(eq(graphs.ownerId, ownerId))
                .orderBy(desc(graphs.updatedAt))
                .all();
            return rows.map(toSummary);
        },

        get,

        async create(ownerId, input) {
            const timestamp = clock();
            const [row] = db
                .insert(graphs)
                .values({
                    ownerId, 
                    name: input.name, 
                    data: input.graph, 
                    schemaVersion: CURRENT_SCHEMA_VERSION, 
                    createdAt: timestamp,
                    updatedAt: timestamp,
                })
                .returning()
                .all();
            return toStoredGraph(row);
        },

        async update(ownerId, id, input, expectedRevision) {
            // The revision check is part of the UPDATE itself, so "check, then write" happens as one step
            // and two requests can never both pass the check.
            const [row] = db
                .update(graphs)
                .set({
                    name: input.name, 
                    data: input.graph, 
                    schemaVersion: CURRENT_SCHEMA_VERSION, 
                    revision: sql`${graphs.revision} + 1`, 
                    updatedAt: clock(), 
                })
                .where(and(eq(graphs.id, id), eq(graphs.ownerId, ownerId), eq(graphs.revision, expectedRevision)))
                .returning()
                .all();
            
                if (row) return { ok: true, graph: toStoredGraph(row) };

                // Nothing was updated. Either the graph is not there, or it has moved on to a newer revision.
                const current = await get(ownerId, id);
                if (!current) return { ok: false, reason: 'not_found' };
                return { ok: false, reason: 'conflict', current };
        },

        async delete(ownerId, id) {
            const removed = db
                .delete(graphs)
                .where(and(eq(graphs.id, id), eq(graphs.ownerId, ownerId)))
                .returning({ id: graphs.id })
                .all();
            return removed.length > 0;
        },
    };
}