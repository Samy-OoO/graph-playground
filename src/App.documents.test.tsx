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

const nameField = () => screen.getByLabelText('Graph name') as HTMLInputElement;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('saving and opening graphs from the page', () => {
  it('starts as a new graph with nothing to save', () => {
    renderApp();
    expect(nameField().value).toBe('Untitled graph');
    expect(screen.getByText('New graph', { selector: 'p' })).toBeTruthy();
    expect((button('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves a graph, then lists it under My graphs', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    await user.clear(nameField());
    await user.type(nameField(), 'Road trip');
    await user.click(button('Save'));

    expect(await screen.findByText('All changes saved')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Open Road trip' })).toBeTruthy();
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
    expect(await screen.findByRole('button', { name: 'Open Untitled graph' })).toBeTruthy();
  });

  it('opens a saved graph from the list', async () => {
    const { user, repository } = renderApp();
    await repository.save(createDocument(twoNodes, 'Stored graph', 'd1', new Date('2026-10-31T09:00:00.000Z')));
    // Saving something else makes the list reload.
    await user.click(button('Load sample'));
    await user.click(button('Save'));

    await user.click(await screen.findByRole('button', { name: 'Open Stored graph' }));

    expect(await screen.findByText('2 nodes, 1 edge')).toBeTruthy();
    expect(nameField().value).toBe('Stored graph');
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
    await screen.findByRole('button', { name: 'Open Untitled graph' });

    await user.click(button('Delete Untitled graph'));
    // The Delete tool also has a button named "Delete", so look only inside the question.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/Nothing saved yet/)).toBeTruthy();
    expect(await screen.findByText('0 nodes, 0 edges')).toBeTruthy();
  });
});

describe('unsaved work found with a graph', () => {
  async function openGraphWithDraft(verdictSetup: 'restore' | 'conflict') {
    const app = renderApp();
    const original = createDocument(twoNodes, 'Stored graph', 'd1', new Date('2026-10-31T09:00:00.000Z'));
    const draft = createDraft(updateDocument(original, movedNodes, new Date('2026-10-31T10:00:00.000Z')), original.updatedAt);
    await app.drafts.save(draft);
    await app.repository.save(
      verdictSetup === 'restore' ? original : updateDocument(original, { ...twoNodes, directed: false }, new Date('2026-10-31T11:00:00.000Z')),
    );
    // Saving a different graph makes the list load, so the stored one can be opened.
    await app.user.click(button('Load sample'));
    await app.user.click(button('Save'));
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