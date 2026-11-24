// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRepository } from './apiRepository';
import { createFakeGraphServer } from './fakeGraphServer';
import { MemoryDraftStore } from './memoryDraftStore';
import { MemoryRepository } from './memoryRepository';
import { StorageProvider } from './StorageProvider';
import type { AppStorage } from './storage';
import { UnauthorizedError } from './unauthorizedError';
import { useStorage } from './useStorage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ShowStorage() {
  const storage = useStorage();
  return <p>{storage.persistent ? 'saved in the browser' : 'memory only'}</p>;
}

describe('StorageProvider', () => {
  it('shows its children right away when it is handed a storage', () => {
    const storage = { repository: new MemoryRepository(), drafts: new MemoryDraftStore(), persistent: false };
    render(
      <StorageProvider storage={storage}>
        <ShowStorage />
      </StorageProvider>,
    );
    expect(screen.getByText('memory only')).toBeTruthy();
  });

  it('opens the real storage and then shows its children', async () => {
    render(
      <StorageProvider>
        <ShowStorage />
      </StorageProvider>,
    );
    expect(await screen.findByText('saved in the browser')).toBeTruthy();
  });
});

// Shows where graphs are kept. Each time it is created from scratch it gets a new random label,
// so a test can tell "the same one, still there" from "started over".
const captured: { storage: AppStorage | null } = { storage: null };
const latestStorage = () => captured.storage as AppStorage;

function WhereAreGraphsKept() {
  const storage = useStorage();
  useEffect(() => {
    captured.storage = storage;
  });
  const [startedAs] = useState(() => Math.random().toString(36).slice(2));
  return (
    <p data-testid="where" data-start={startedAs}>
      {storage.repository instanceof ApiRepository ? 'on the server' : 'in this browser'}
    </p>
  );
}

describe('StorageProvider and accounts', () => {
  it('keeps graphs in this browser for a guest', async () => {
    render(
      <StorageProvider userId={null}>
        <WhereAreGraphsKept />
      </StorageProvider>,
    );
    expect((await screen.findByTestId('where')).textContent).toBe('in this browser');
  });

  it('keeps graphs on the server for a signed-in user', async () => {
    render(
      <StorageProvider userId="user-a">
        <WhereAreGraphsKept />
      </StorageProvider>,
    );
    expect((await screen.findByTestId('where')).textContent).toBe('on the server');
  });

  it('starts everything over, and never lends out the old storage, when the user changes', async () => {
    const view = render(
      <StorageProvider userId={null}>
        <WhereAreGraphsKept />
      </StorageProvider>,
    );
    const first = await screen.findByTestId('where');
    const firstStart = first.getAttribute('data-start');

    view.rerender(
      <StorageProvider userId="user-a">
        <WhereAreGraphsKept />
      </StorageProvider>,
    );

    // For a moment nothing is shown, rather than the guest's storage under the new user's name.
    expect(screen.queryByTestId('where')).toBeNull();

    const second = await screen.findByTestId('where');
    expect(second.textContent).toBe('on the server');
    expect(second.getAttribute('data-start')).not.toBe(firstStart);
  });

  it('uses the newest "session ended" callback without rebuilding the storage', async () => {
    const server = createFakeGraphServer();
    vi.stubGlobal('fetch', server.fetchFn);
    const oldCallback = vi.fn();
    const newCallback = vi.fn();

    const view = render(
      <StorageProvider userId="user-a" onUnauthorized={oldCallback}>
        <WhereAreGraphsKept />
      </StorageProvider>,
    );
    const shown = await screen.findByTestId('where');
    const start = shown.getAttribute('data-start');

    // A parent that re-renders hands over a brand-new function every time.
    view.rerender(
      <StorageProvider userId="user-a" onUnauthorized={newCallback}>
        <WhereAreGraphsKept />
      </StorageProvider>,
    );
    expect(screen.getByTestId('where').getAttribute('data-start')).toBe(start);

    server.answerNextWith(401, { error: 'You need to sign in.' });
    await expect(latestStorage().repository.list()).rejects.toBeInstanceOf(UnauthorizedError);

    await waitFor(() => expect(newCallback).toHaveBeenCalledTimes(1));
    expect(oldCallback).not.toHaveBeenCalled();
  });
});

describe('useStorage', () => {
  it('complains when used outside a StorageProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ShowStorage />)).toThrow(/StorageProvider/);
  });
});