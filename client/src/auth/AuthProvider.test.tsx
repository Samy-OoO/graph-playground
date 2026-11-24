// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import type { AuthContextValue } from './authContext';
import { ann, createFakeAuthApi } from './fakeAuthApi';
import { useAuth } from './useAuth';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// Shows the state as text, and keeps the latest actions so tests can call them.
const captured: { auth: AuthContextValue | null } = { auth: null };
const latest = () => captured.auth as AuthContextValue;

function Probe() {
    const auth = useAuth();
    useEffect(() => {
        captured.auth = auth;
    });
    const { state } = auth;
    const text =
        state.status === 'signedIn'
            ? `signed in as ${state.user.email}`
            : state.status === 'guest'
              ? `guest${state.notice ? ` (${state.notice})` : ''}`
              : 'loading';
    return <p role="status">{text}</p>;
}

function renderWith(api = createFakeAuthApi()) {
    render(
        <AuthProvider api={api}>
            <Probe />
        </AuthProvider>,
    );
    return api;
}

const credentials = { email: 'ann@example.com', password: 'a long password' };

describe('AuthProvider', () => {
    describe('at startup', () => {
        it('is loading until the server has answered', async () => {
            let answer: (user: typeof ann | null) => void = () => {};
            renderWith(createFakeAuthApi({ me: () => new Promise((resolve) => (answer = resolve)) }));

            expect(screen.getByRole('status').textContent).toBe('loading');
            await act(async () => answer(ann));
            expect(screen.getByRole('status').textContent).toBe('signed in as ann@example.com');
        });

        it('is a guest when nobody is signed in', async () => {
            renderWith();
            expect((await screen.findByText('guest')).textContent).toBe('guest');
        });

        it('carries on as a guest when the server cannot be reached', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            renderWith(createFakeAuthApi({ me: vi.fn().mockRejectedValue(new Error('Could not reach the server.')) }));
            expect(await screen.findByText('guest')).toBeTruthy();
        });
    });

    describe('signing in and out', () => {
        it('becomes signed in after a successful login', async () => {
            const api = renderWith();
            await screen.findByText('guest');

            let outcome;
            await act(async () => {
                outcome = await latest().login(credentials);
            });

            expect(api.login).toHaveBeenCalledWith(credentials);
            expect(outcome).toEqual({ ok: true, user: ann });
            expect(screen.getByRole('status').textContent).toBe('signed in as ann@example.com');
        });

        it('stays a guest, and passes on the message, when the login is refused', async () => {
            renderWith(
                createFakeAuthApi({
                    login: vi.fn().mockResolvedValue({ ok: false, message: 'Email or password is incorrect.' }),
                }),
            );
            await screen.findByText('guest');

            let outcome;
            await act(async () => {
                outcome = await latest().login(credentials);
            });

            expect(outcome).toEqual({ ok: false, message: 'Email or password is incorrect.' });
            expect(screen.getByRole('status').textContent).toBe('guest');
        });

        it('becomes signed in after registering', async () => {
            renderWith();
            await screen.findByText('guest');
            await act(async () => {
                await latest().register(credentials);
            });
            expect(screen.getByRole('status').textContent).toBe('signed in as ann@example.com');
        });

        it('becomes a guest after signing out', async () => {
            const api = renderWith(createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) }));
            await screen.findByText('signed in as ann@example.com');

            let message;
            await act(async () => {
                message = await latest().logout();
            });

            expect(api.logout).toHaveBeenCalled();
            expect(message).toBeNull();
            expect(screen.getByRole('status').textContent).toBe('guest');
        });

        it('stays signed in, and says why, when signing out did not work', async () => {
            renderWith(
                createFakeAuthApi({
                    me: vi.fn().mockResolvedValue(ann),
                    logout: vi.fn().mockRejectedValue(new Error('Could not reach the server.')),
                }),
            );
            await screen.findByText('signed in as ann@example.com');

            let message;
            await act(async () => {
                message = await latest().logout();
            });

            expect(message).toBe('Could not reach the server.');
            expect(screen.getByRole('status').textContent).toBe('signed in as ann@example.com');
        });
    });

    describe('when the session ends', () => {
        it('turns a signed-in user into a guest with a notice, which can be dismissed', async () => {
            renderWith(createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) }));
            await screen.findByText('signed in as ann@example.com');

            act(() => latest().sessionEnded());
            expect(screen.getByRole('status').textContent).toBe('guest (session-ended)');

            act(() => latest().dismissNotice());
            expect(screen.getByRole('status').textContent).toBe('guest');
        });

        it('says nothing when nobody was signed in, however many requests fail', async () => {
            renderWith();
            await screen.findByText('guest');

            act(() => latest().sessionEnded());
            act(() => latest().sessionEnded());

            await waitFor(() => expect(screen.getByRole('status').textContent).toBe('guest'));
        });
    });

    it('reports that accounts are not available when there is no provider', () => {
        function Bare() {
            return <p>{useAuth().available ? 'accounts' : 'no accounts'}</p>;
        }
        render(<Bare />);
        expect(screen.getByText('no accounts')).toBeTruthy();
    });
});