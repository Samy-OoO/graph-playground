import { randomUUID } from 'node:crypto';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { GraphDocument } from '@graph-playground/shared';

// Every timestamp is stored as an ISO text string, the same format the client already uses.
const now = () => new Date().toISOString();

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),
    email: text('email').notNull().unique(),
    passwordHash: text('password-hash').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(now),
});

export const graphs = sqliteTable('graphs', {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),
    ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    //Only the nodes and edges live here. Name and timestamps are real columns so we can sort and list without opening the JSON.
    data: text('data', { mode: 'json' }).$type<GraphDocument['graph']>().notNull(),
    schemaVersion: integer('schema_version').notNull(),
    // Goes up by one on every save later, a save that carries an old revision is rejected with 409.
    revision: integer('revision').notNull().default(1),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
    shareSlug: text('share_slug').unique(),
    createdAt: text('created_at').notNull().$defaultFn(now),
    updatedAt: text('updated_at').notNull().$defaultFn(now),
}, 
// "List my graphs" will filter by owner on every req, so give that lookup an index.
(table) => [index('graphs_owner_id_idx').on(table.ownerId)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type GraphRow = typeof graphs.$inferSelect;
export type NewGraphRow = typeof graphs.$inferInsert;

