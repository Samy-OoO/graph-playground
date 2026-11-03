// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryDraftStore } from './memoryDraftStore';
import { MemoryRepository } from './memoryRepository';
import { StorageProvider } from './StorageProvider';
import { useStorage } from './useStorage';

afterEach(cleanup);

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

describe('useStorage', () => {
  it('complains when used outside a StorageProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ShowStorage />)).toThrow(/StorageProvider/);
  });
});