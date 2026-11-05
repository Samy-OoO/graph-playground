// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './test/dialogPolyfill';
import App from './App';
import { createDocument, updateDocument } from './persistence/convert';
import { createDraft } from './persistence/draft';
import { MemoryDraftStore } from './persistence/memoryDraftStore';
import { MemoryRepository } from './persistence/memoryRepository';
import { StorageProvider } from './persistence/StorageProvider';
import { serializeDocument } from './persistence/fileTransfer';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe('copies, renaming and pictures', () => {
  const stored = () => createDocument(twoNodes, 'Stored graph', 'd1', new Date('2026-10-31T09:00:00.000Z'));

  it('shows a small picture of each saved graph', async () => {
    const { user, repository } = renderApp();
    await repository.save(stored());

    await openLibrary(user);
    const open = await screen.findByRole('button', { name: 'Open Stored graph' });

    const picture = open.querySelector('img');
    expect(picture?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
  });

  it('saves a copy that includes unsaved changes and leaves the original alone', async () => {
    const { user, repository } = renderApp();
    await repository.save(stored());
    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Open Stored graph' }));
    await screen.findByText('All changes saved');
    await user.click(button('Clear graph')); // an unsaved change

    await user.click(button('Save a copy'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByRole('textbox') as HTMLInputElement;
    expect(field.value).toBe('Stored graph (copy)');
    await user.clear(field);
    await user.type(field, 'Branch');
    await user.click(within(dialog).getByRole('button', { name: 'Save copy' }));

    expect(await screen.findByText('All changes saved')).toBeTruthy();
    expect(nameField().value).toBe('Branch');
    expect((await repository.get('d1'))?.graph.nodes).toHaveLength(2); // the original is as it was
    const names = (await repository.list()).map((graph) => graph.name).sort();
    expect(names).toEqual(['Branch', 'Stored graph']);
  });

  it('duplicates a graph from the list', async () => {
    const { user, repository } = renderApp();
    await repository.save(stored());

    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Duplicate Stored graph' }));

    expect(await screen.findByRole('button', { name: 'Open Stored graph (copy)' })).toBeTruthy();
    expect(await repository.list()).toHaveLength(2);
  });

  it('renames a graph that is not open, straight from the list', async () => {
    const { user, repository } = renderApp();
    await repository.save(stored());

    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Rename Stored graph' }));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByRole('textbox') as HTMLInputElement;
    await user.clear(field);
    await user.type(field, 'Better name');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));

    expect(await screen.findByRole('button', { name: 'Open Better name' })).toBeTruthy();
    expect((await repository.get('d1'))?.name).toBe('Better name');
  });

  it('renames the open graph on screen, to be saved with the next Save', async () => {
    const { user, repository } = renderApp();
    await repository.save(stored());
    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Open Stored graph' }));
    await screen.findByText('All changes saved');

    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Rename Stored graph' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/saved with your next Save/)).toBeTruthy();
    const field = within(dialog).getByRole('textbox') as HTMLInputElement;
    await user.clear(field);
    await user.type(field, 'Renamed open graph');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));

    expect(nameField().value).toBe('Renamed open graph');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect((await repository.get('d1'))?.name).toBe('Stored graph'); // not saved yet
  });

  it('does not accept an empty name', async () => {
    const { user, repository } = renderApp();
    await repository.save(stored());
    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'Rename Stored graph' }));
    const dialog = await screen.findByRole('dialog');

    await user.clear(within(dialog).getByRole('textbox'));

    expect((within(dialog).getByRole('button', { name: 'Rename' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('import and export', () => {
  const shared = () => createDocument(twoNodes, 'Shared graph', 'id-from-the-file', new Date('2026-10-31T09:00:00.000Z'));
  const fileInput = () => screen.getByLabelText('Import graph file') as HTMLInputElement;

  it('exports the graph on screen as a named .json file', async () => {
    const { user } = renderApp();
    const createObjectURL = vi.fn(() => 'blob:fake-address');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    await user.click(button('Load sample'));
    await user.clear(nameField());
    await user.type(nameField(), 'Road trip');

    await openLibrary(user);
    await user.click(button('Export this graph'));

    expect(downloadName).toBe('road-trip.json');
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const exported = JSON.parse(await blob.text());
    expect(exported.name).toBe('Road trip');
    expect(exported.graph.nodes.length).toBeGreaterThan(0); // unsaved changes are included
  });

  it('imports a file as a new, unsaved graph', async () => {
    const { user } = renderApp();
    const file = new File([serializeDocument(shared())], 'shared.json', { type: 'application/json' });

    await user.upload(fileInput(), file);

    expect(await screen.findByText('2 nodes, 1 edge')).toBeTruthy();
    expect(nameField().value).toBe('Shared graph');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('gives an imported graph its own identity, so it never overwrites a saved one', async () => {
    const { user, repository } = renderApp();
    await repository.save(shared()); // the same id as the one inside the file
    await user.upload(fileInput(), new File([serializeDocument(shared())], 'shared.json'));
    await screen.findByText('Unsaved changes');

    await user.click(button('Save'));
    await screen.findByText('All changes saved');

    expect(await repository.list()).toHaveLength(2);
  });

  it('explains why a file that is not a graph was refused, and leaves the graph alone', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));

    // A file picker can be switched to "All files", so a wrong kind of file can still arrive.
    // The test helper normally filters by the input's `accept`, like a picker would, so turn that off.
    const picker = userEvent.setup({ applyAccept: false });
    await picker.upload(fileInput(), new File(['this is not json'], 'notes.txt'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not import "notes.txt"');
    expect(alert.textContent).toContain('not valid JSON');
    expect(screen.queryByRole('dialog')).toBeNull(); // no unsaved-changes question for a file that failed
    expect(screen.queryByText('0 nodes, 0 edges')).toBeNull();
  });

  it('asks about unsaved changes before an import replaces the graph', async () => {
    const { user } = renderApp();
    await user.click(button('Load sample'));

    await user.upload(fileInput(), new File([serializeDocument(shared())], 'shared.json'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Unsaved changes')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByText('2 nodes, 1 edge')).toBeTruthy();
    expect(nameField().value).toBe('Shared graph');
  });
});