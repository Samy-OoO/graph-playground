import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from "../db/connection";
import { graphs, type GraphRow } from "../db/schema";
import type { GraphRepository } from "./graphRepository";
import type { StoredGraph } from "./types";
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


// The clock is a parameter so tests can control time instead of waiting for it.
export function createGraphRepository(db: Db): GraphRepository {
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
            return rows.map(toStoredGraph);
        },

        get,


        async save(ownerId, input, expectedRevision) {
            if (expectedRevision === 0) {
                // "This graph is new": insert it, unless this owner already has one with that id.
                const [created] = db
                    .insert(graphs)
                    .values({
                        id: input.id, 
                        ownerId, 
                        name: input.name, 
                        data: input.graph, 
                        schemaVersion: CURRENT_SCHEMA_VERSION, 
                        createdAt: input.createdAt,
                        updatedAt: input.updatedAt,
                    })
                    .onConflictDoNothing()
                    .returning()
                    .all();
                if (created) return { ok: true, graph: toStoredGraph(created) };
                    
                // It already exists, so the caller was wrong about it being new.
                const current = await get(ownerId, input.id);
                if (!current) return { ok: false, reason: 'not_found' };
                return { ok: false, reason: 'conflict', current };
            }


            // The revision check is part of the UPDATE itself, so "check, then write" happens as one step
            // and two requests can never both pass the check.
            const [updated] = db
                .update(graphs)
                .set({
                    name: input.name, 
                    data: input.graph, 
                    schemaVersion: CURRENT_SCHEMA_VERSION, 
                    revision: sql`${graphs.revision} + 1`, 
                    updatedAt: input.updatedAt, 
                })
                .where(and(eq(graphs.id, input.id), eq(graphs.ownerId, ownerId), eq(graphs.revision, expectedRevision)))
                .returning()
                .all();
            
            if (updated) return { ok: true, graph: toStoredGraph(updated) };

            // Nothing was updated. Either the graph is not there, or it has moved on to a newer revision.
            const current = await get(ownerId, input.id);
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