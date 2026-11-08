import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbDraftStore } from './indexedDbDraftStore';
import { IndexedDbRepository } from './indexedDbRepository';
import { MemoryDraftStore } from './memoryDraftStore';
import { MemoryRepository } from './memoryRepository';
import { createStorage, getAppStorage } from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createStorage', () => {
  it('uses IndexedDB when it is available', async () => {
    const storage = await createStorage('storage-test-ok');
    expect(storage.persistent).toBe(true);
    expect(storage.repository).toBeInstanceOf(IndexedDbRepository);
    expect(storage.drafts).toBeInstanceOf(IndexedDbDraftStore);
  });

  it('falls back to memory when the browser has no IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const storage = await createStorage('storage-test-missing');
    expect(storage.persistent).toBe(false);
    expect(storage.repository).toBeInstanceOf(MemoryRepository);
    expect(storage.drafts).toBeInstanceOf(MemoryDraftStore);
  });

  it('falls back to memory when opening the database fails', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        throw new Error('Access denied');
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const storage = await createStorage('storage-test-denied');
    expect(storage.persistent).toBe(false);
  });
});

describe('getAppStorage', () => {
  it('creates the storage once and hands the same one to everybody', async () => {
    const first = getAppStorage();
    const second = getAppStorage();
    expect(second).toBe(first);
    expect((await first).persistent).toBe(true);
  });
});