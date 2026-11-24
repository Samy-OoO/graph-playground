import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbDraftStore } from './indexedDbDraftStore';
import { IndexedDbRepository } from './indexedDbRepository';
import { MemoryDraftStore } from './memoryDraftStore';
import { MemoryRepository } from './memoryRepository';
import { createStorage, getAppStorage, storageNameFor } from './storage';
import { ApiRepository } from './apiRepository';
import { createFakeGraphServer } from './fakeGraphServer';
import { UnauthorizedError } from './unauthorizedError';

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

    it('keeps graphs on the server, and drafts in this browser, when asked to', async () => {
    const storage = await createStorage('storage-test-server', { useServer: true });
    expect(storage.repository).toBeInstanceOf(ApiRepository);
    expect(storage.drafts).toBeInstanceOf(IndexedDbDraftStore);
    expect(storage.persistent).toBe(true);
  });

  it('still uses the server for graphs when the browser has no IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const storage = await createStorage('storage-test-server-nodb', { useServer: true });
    expect(storage.repository).toBeInstanceOf(ApiRepository);
    expect(storage.drafts).toBeInstanceOf(MemoryDraftStore);
    expect(storage.persistent).toBe(true);
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

describe('storageNameFor', () => {
  it('gives guests the default database and every user a database of their own', () => {
    expect(storageNameFor(null)).toBeUndefined();
    expect(storageNameFor('user-a')).toBe('graph-playground-user-user-a');
    expect(storageNameFor('user-a')).not.toBe(storageNameFor('user-b'));
  });
});

describe('createStorage for a signed-in user', () => {
  it('passes the "session ended" callback on to the server repository', async () => {
    const server = createFakeGraphServer();
    vi.stubGlobal('fetch', server.fetchFn);
    const onUnauthorized = vi.fn();
    const storage = await createStorage('storage-test-unauthorized', { useServer: true, onUnauthorized });

    server.answerNextWith(401, { error: 'You need to sign in.' });

    await expect(storage.repository.list()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
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