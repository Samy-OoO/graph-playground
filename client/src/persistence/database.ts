import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Draft } from './draft';
import type { GraphDocument } from './schema';

export const DEFAULT_DB_NAME = 'graph-playground';
export const DATABASE_VERSION = 2;
export const GRAPHS_STORE = 'graphs';
export const DRAFTS_STORE = 'drafts';

export interface GraphDB extends DBSchema {
    graphs: {
        key: string;
        value: GraphDocument;
    };
    drafts: {
        key: string;
        value: Draft;
    };
}

export type GraphDBConnection = IDBPDatabase<GraphDB>;

// Opens the app's DB, creating or upgrading it if needed.
export function openGraphDB(name: string = DEFAULT_DB_NAME): Promise<GraphDBConnection> {
    return openDB<GraphDB>(name, DATABASE_VERSION, {
        upgrade(db, oldVersion) {
            // Version 1 introduced the saved graphs.
            if (oldVersion < 1) {
                db.createObjectStore(GRAPHS_STORE, { keyPath: 'id' });
            }

            // Version 2 introduced drafts, keyed by the id of the graph inside each draft.
            if (oldVersion < 2) {
                db.createObjectStore(DRAFTS_STORE, { keyPath: 'document.id' });
            }
        },
    });
}

