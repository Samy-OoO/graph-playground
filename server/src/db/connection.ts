import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

// The migration files live in server/drizzle, two folders above this file.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

// Opens the DB (a file path, or ':memory:' for tests) and brings its tables up to date.
export function createDb(path: string) {
    const sqlite = new Database(path); // Establishes communication between Node & SQLite DB

    // SQLite ignores foreign keys unless you switched on for every connection.
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder }); // For DB schema changes.

    return { db, close: () => sqlite.close() };
}

export type Db = ReturnType<typeof createDb>['db'];
