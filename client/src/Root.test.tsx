// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './test/dialogPolyfill';
import { AuthProvider } from './auth/AuthProvider';
import { ann, createFakeAuthApi } from './auth/fakeAuthApi';
import { createFakeGraphServer } from './persistence/fakeGraphServer';
import { Root } from './Root';

// The whole sign-in path, from the title bar to where graphs are stored. Only the network is pretend.
let server: ReturnType<typeof createFakeGraphServer>;

beforeEach(() => {
  server = createFakeGraphServer();
  vi.stubGlobal('fetch', server.fetchFn);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const graphRequests = () => server.requests.filter((request) => request.path.startsWith('/api/graphs'));

async function openMyGraphs(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'My graphs' }));
  await screen.findByRole('region', { name: 'Saved graphs' });
}

describe('Root', () => {
  it('shows nothing until the server has said who is signed in', () => {
    const api = createFakeAuthApi({ me: () => new Promise(() => {}) });
    const { container } = render(
      <AuthProvider api={api}>
        <Root />
      </AuthProvider>,
    );
    expect(container.textContent).toBe('');
  });

  it('keeps a guest\'s graphs in the browser and never calls the graph API', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider api={createFakeAuthApi()}>
        <Root />
      </AuthProvider>,
    );

    await openMyGraphs(user);

    expect(screen.getByText(/Nothing saved yet/)).toBeTruthy();
    expect(graphRequests()).toHaveLength(0);
  });

  it('starts out on the server for somebody who is already signed in', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider api={createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) })}>
        <Root />
      </AuthProvider>,
    );

    await openMyGraphs(user);

    await waitFor(() => expect(graphRequests().length).toBeGreaterThan(0));
    expect(graphRequests()[0]).toMatchObject({ method: 'GET', path: '/api/graphs' });
  });

  it('moves graphs to the server when a guest signs in, and back to the browser on signing out', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider api={createFakeAuthApi()}>
        <Root />
      </AuthProvider>,
    );

    // Sign in through the real dialog.
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Email'), 'ann@example.com');
    await user.type(dialog.getByLabelText('Password'), 'a long password');
    // Inside the dialog: a real browser makes the page behind it inert, but the test browser does not.
    await user.click(dialog.getByRole('button', { name: 'Sign in' }));

    // The account button replaces "Sign in", and "My graphs" now reads from the server.
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    expect(screen.getByText('ann@example.com')).toBeTruthy();
    await openMyGraphs(user);
    await waitFor(() => expect(graphRequests().length).toBeGreaterThan(0));

    // Sign out again: back to a guest, with the browser's storage.
    const before = graphRequests().length;
    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();

    await openMyGraphs(user);
    expect(screen.getByText(/Nothing saved yet/)).toBeTruthy();
    expect(graphRequests()).toHaveLength(before);
  });

  it('puts a signed-in user back to being a guest, with the sign-in dialog, when the session ends', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // the failed list is logged, which is expected here
    const user = userEvent.setup();
    render(
      <AuthProvider api={createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) })}>
        <Root />
      </AuthProvider>,
    );
    await openMyGraphs(user);
    await waitFor(() => expect(graphRequests().length).toBeGreaterThan(0));

    // Close the panel, then make the server stop recognising the cookie, as if it had expired while the person worked.
    await user.click(screen.getByRole('button', { name: 'My graphs' }));
    server.answerNextWith(401, { error: 'You need to sign in.' });
    await user.click(screen.getByRole('button', { name: 'My graphs' })); // opening it asks the server again

    expect(await screen.findByText(/Your session ended/)).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });
});