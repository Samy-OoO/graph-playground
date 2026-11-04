// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import './test/dialogPolyfill';
import App from './App';
import { createDocument, updateDocument } from './persistence/convert';
import { createDraft } from './persistence/draft';
import { MemoryDraftStore } from './persistence/memoryDraftStore';
import { MemoryRepository } from './persistence/memoryRepository';
import { StorageProvider } from './persistence/StorageProvider';

afterEach(cleanup);

const twoNodes = {
  directed: true,
  weighted: false,
  nodes: [
    { id: 'a', x: 100, y: 100, label: 'A' },
    { id: 'b', x: 200, y: 150, label: 'B' },
  ],
  edges: [{ id: 'e1', source: 'a', destination: 'b' }],
};
const movedNodes = { ...twoNodes, nodes: [{ ...twoNodes.nodes[0], x: 400 }, twoNodes.nodes[1]] };

function renderApp(persistent = true) {
  const repository = new MemoryRepository();
  const drafts = new MemoryDraftStore();
  const view = render(
    <StorageProvider storage={{ repository, drafts, persistent }}>
      <App />
    </StorageProvider>,
  );
  return { repository, drafts, user: userEvent.setup(), view };
}

type User = ReturnType<typeof userEvent.setup>;

const nameField = () => screen.getByLabelText('Graph name') as HTMLInputElement;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const openLibrary = (user: User) => user.click(button('My graphs'));

describe('the title bar', () => {
  it('starts as a new graph with nothing to save', () => {
    renderApp();
    expect(nameField().value).toBe('Untitled graph');
    expect(screen.getByText('New graph', { selector: 'p' })).toBeTruthy();
    expect((button('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the saved graphs hidden behind an icon until it is opened', async () => {
    const { user, repository } = renderApp();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', new Date('2026-10-31T09:00:00.000Z')));

    expect(button('My graphs').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Saved graphs' })).toBeNull();

    await openLibrary(user);

    expect(button('My graphs').getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('button', { name: 'Open Stored graph' })).toBeTruthy();
  });

  it('closes the list again with the icon, with Escape, or by clicking elsewhere', async () => {
    const { user } = renderApp();
    const list = () => screen.queryByRole('region', { name: 'Saved graphs' });

    await openLibrary(user);
    expect(list()).not.toBeNull();
    await user.click(button('My graphs'));
    expect(list()).toBeNull();

    await openLibrary(user);
    await user.keyboard('{Escape}');
    expect(list()).toBeNull();

    await openLibrary(user);
    await user.click(nameField());
    expect(list()).toBeNull();
  });
});

describe('saving and opening graphs from the page', () => {
  it('saves a graph, then lists it under My graphs', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    await user.clear(nameField());
    await user.type(nameField(), 'Road trip');
    await user.click(button('Save'));

    expect(await screen.findByText('All changes saved')).toBeTruthy();
    await openLibrary(user);
    expect(await screen.findByRole('button', { name: 'Open Road trip' })).toBeTruthy();
  });

  it('shows an error, and keeps the changes, when saving fails', async () => {
    const { user, repository } = renderApp();
    repository.save = async () => {
      throw new Error('This graph cannot be saved: graph.edges: too many');
    };
    await user.click(button('Load sample'));

    await user.click(button('Save'));

    expect(await screen.findByText('Could not save')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('cannot be saved');
    expect((button('Save') as HTMLButtonElement).disabled).toBe(false); // can be retried
  });

  it('asks before replacing a graph that has unsaved changes, and Cancel keeps it', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));

    await user.click(button('New graph'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Unsaved changes')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('0 nodes, 0 edges')).toBeNull();
  });

  it('can discard the changes and carry on to a blank graph', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));
    await user.click(button('New graph'));

    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));

    expect(await screen.findByText('0 nodes, 0 edges')).toBeTruthy();
  });

  it('can save first and then carry on to a blank graph', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));
    await user.click(button('New graph'));

    await user.click(await screen.findByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByText('0 nodes, 0 edges')).toBeTruthy();
    await openLibrary(user);
    expect(await screen.findByRole('button', { name: 'Open Untitled graph' })).toBeTruthy();
  });

  it('opens a saved graph from the list, and the list closes', async () => {
    const { user, repository } = renderApp();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', new Date('2026-10-31T09:00:00.000Z')));

    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Open Stored graph' }));

    expect(await screen.findByText('2 nodes, 1 edge')).toBeTruthy();
    expect(nameField().value).toBe('Stored graph');
    expect(screen.queryByRole('region', { name: 'Saved graphs' })).toBeNull();
  });

  it('reverts to the saved version after confirming', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));
    await user.click(button('Save'));
    await screen.findByText('All changes saved');

    await user.click(button('Clear graph'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    await user.click(button('Revert'));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));

    expect(await screen.findByText('All changes saved')).toBeTruthy();
    expect(screen.queryByText('0 nodes, 0 edges')).toBeNull();
  });

  it('deletes a graph after confirming, and starts a new one if it was the open graph', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));
    await user.click(button('Save'));
    await screen.findByText('All changes saved');

    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Delete Untitled graph' }));
    // The Delete tool also has a button named "Delete", so look only inside the question.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/Nothing saved yet/)).toBeTruthy();
    expect(await screen.findByText('0 nodes, 0 edges')).toBeTruthy();
  });
});

describe('unsaved work found with a graph', () => {
  async function openGraphWithDraft(setup: 'restore' | 'conflict') {
    const app = renderApp();
    const original = createDocument(twoNodes, 'Stored graph', 'd1', new Date('2026-10-31T09:00:00.000Z'));
    const draft = createDraft(updateDocument(original, movedNodes, new Date('2026-10-31T10:00:00.000Z')), original.updatedAt);
    await app.drafts.save(draft);
    await app.repository.save(
      setup === 'restore' ? original : updateDocument(original, { ...twoNodes, directed: false }, new Date('2026-10-31T11:00:00.000Z')),
    );
    await openLibrary(app.user);
    await app.user.click(await screen.findByRole('button', { name: 'Open Stored graph' }));
    return app;
  }

  it('offers to restore it, and restoring leaves unsaved changes', async () => {
    const { user } = await openGraphWithDraft('restore');

    const notice = await screen.findByRole('group', { name: 'Unsaved work found' });
    expect(within(notice).getByText(/unsaved changes from an earlier visit/)).toBeTruthy();

    await user.click(within(notice).getByRole('button', { name: 'Restore changes' }));

    expect(await screen.findByText('Unsaved changes')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Unsaved work found' })).toBeNull();
  });

  it('can throw the unsaved work away', async () => {
    const { user, drafts } = await openGraphWithDraft('restore');

    const notice = await screen.findByRole('group', { name: 'Unsaved work found' });
    await user.click(within(notice).getByRole('button', { name: 'Discard them' }));

    expect(screen.queryByRole('group', { name: 'Unsaved work found' })).toBeNull();
    expect(await drafts.get('d1')).toBeNull();
  });

  it('explains a conflict in different words', async () => {
    await openGraphWithDraft('conflict');

    const notice = await screen.findByRole('group', { name: 'Unsaved work found' });
    expect(within(notice).getByText(/saved again after these unsaved changes were started/)).toBeTruthy();
    expect(within(notice).getByRole('button', { name: 'Keep the saved version' })).toBeTruthy();
  });
});

describe('notices', () => {
  it('warns when the browser would not give the app any storage', () => {
    renderApp(false);
    expect(screen.getByText(/not letting the app store anything/)).toBeTruthy();
  });

  it('does not warn when storage works', () => {
    renderApp(true);
    expect(screen.queryByText(/not letting the app store anything/)).toBeNull();
  });
});