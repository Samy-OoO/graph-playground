import { ApiRepository } from "./apiRepository";
import { openGraphDB } from "./database";
import type { DraftStore } from "./draftStore";
import { IndexedDbDraftStore } from "./indexedDbDraftStore";
import { IndexedDbRepository } from "./indexedDbRepository";
import { MemoryDraftStore } from "./memoryDraftStore";
import { MemoryRepository } from "./memoryRepository";
import type { GraphRepository } from "./repository";

export type AppStorage = {
    repository: GraphRepository;
    drafts: DraftStore;
    persistent: boolean; // When no IndexedDB
};

export type StorageOptions = {
    // Keep saved graphs on the server instead of in this browser. Drafts always stay on this device.
    useServer?: boolean;
};

export async function createStorage(dbName?: string, options: StorageOptions = {}): Promise<AppStorage> {
    const remote = options.useServer ? new ApiRepository() : null;

    try {
        const probe = await openGraphDB(dbName);
        probe.close();
        return {
            repository: remote ?? new IndexedDbRepository(dbName),
            drafts: new IndexedDbDraftStore(dbName),
            persistent: true,
        };
    } catch (e) {
        console.warn("IndexedDB is not callable, so graphs will be erased upon refresh.", e);
        return {
            repository: remote ?? new MemoryRepository(),
            drafts: new MemoryDraftStore(),
            // Graphs on the server survive a refresh even when this browser cannot store anything.
            persistent: remote !== null,
        };
    }
}

let shared: Promise<AppStorage> | null = null;

// The storage that the whole app shares. Created on first use, then reused.
export function getAppStorage(): Promise<AppStorage> {
    // Until login exists, a setting in env.local decides where graphs are kept (see VITE_USE_SERVER).
    shared ??= createStorage(undefined, { useServer: import.meta.env.VITE_USE_SERVER === 'true' });
    return shared;
}
