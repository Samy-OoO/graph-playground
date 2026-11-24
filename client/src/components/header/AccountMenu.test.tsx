// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../test/dialogPolyfill';
import { AuthProvider } from '../../auth/AuthProvider';
import type { AuthContextValue } from '../../auth/authContext';
import { ann, createFakeAuthApi } from '../../auth/fakeAuthApi';
import { useAuth } from '../../auth/useAuth';
import type { UnsavedGuard } from '../../hooks/useUnsavedGuard';
import { AccountMenu } from './AccountMenu';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// A guard that lets everything through at once, as if nothing were unsaved.
function openGuard(): UnsavedGuard & { run: ReturnType<typeof vi.fn> } {
    return {
        run: vi.fn((action: () => unknown) => {
            void action();
        }),
        asking: false,
        cancel: () => {},
        saveAndContinue: async () => {},
        discardAndContinue: async () => {},
    };
}

const captured: { auth: AuthContextValue | null } = { auth: null };
const latest = () => captured.auth as AuthContextValue;

function Capture() {
    const auth = useAuth();
    useEffect(() => {
        captured.auth = auth;
    });
    return null;
}

function renderMenu(api = createFakeAuthApi(), guard = openGuard()) {
    render(
        <AuthProvider api={api}>
            <Capture />
            <AccountMenu guard={guard} />
        </AuthProvider>,
    );
    return { api, guard, user: userEvent.setup() };
}

describe('AccountMenu', () => {
    it('shows nothing at all without an AuthProvider', () => {
        const { container } = render(<AccountMenu guard={openGuard()} />);
        expect(container.textContent).toBe('');
    });

    it('shows nothing while it is still finding out who is signed in', () => {
        const api = createFakeAuthApi({ me: () => new Promise(() => {}) });
        const { container } = render(
            <AuthProvider api={api}>
                <AccountMenu guard={openGuard()} />
            </AuthProvider>,
        );
        expect(container.textContent).toBe('');
    });

    describe('for a guest', () => {
        it('offers to sign in', async () => {
            renderMenu();
            expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
        });

        it('checks for unsaved changes before opening the sign-in dialog', async () => {
            const guard = openGuard();
            guard.run.mockImplementation(() => {}); // the guard is asking the person, and has not continued yet
            const { user } = renderMenu(createFakeAuthApi(), guard);

            await user.click(await screen.findByRole('button', { name: 'Sign in' }));

            expect(guard.run).toHaveBeenCalled();
            expect(screen.queryByLabelText('Email')).toBeNull();
        });

        it('opens the sign-in dialog once the guard lets it through', async () => {
            const { user } = renderMenu();
            await user.click(await screen.findByRole('button', { name: 'Sign in' }));
            expect(await screen.findByLabelText('Email')).toBeTruthy();
        });

        it('opens the dialog by itself, with an explanation, when the session ended', async () => {
            renderMenu(createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) }));
            await screen.findByRole('button', { name: 'Account' });

            act(() => latest().sessionEnded());

            expect(await screen.findByLabelText('Email')).toBeTruthy();
            expect(screen.getByRole('status').textContent).toMatch(/session ended/i);
        });

        it('stops showing that explanation once the dialog is closed', async () => {
            const { user } = renderMenu(createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) }));
            await screen.findByRole('button', { name: 'Account' });
            act(() => latest().sessionEnded());
            await screen.findByLabelText('Email');

            await user.click(screen.getByRole('button', { name: 'Cancel' }));

            await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull());
        });
    });

    describe('for a signed-in user', () => {
        const signedIn = () => createFakeAuthApi({ me: vi.fn().mockResolvedValue(ann) });

        it('shows an account button, and the email once opened', async () => {
            const { user } = renderMenu(signedIn());
            await user.click(await screen.findByRole('button', { name: 'Account' }));

            expect(screen.getByText('ann@example.com')).toBeTruthy();
            expect(screen.getByText(/saved to your account/)).toBeTruthy();
        });

        it('closes the menu with Escape', async () => {
            const { user } = renderMenu(signedIn());
            await user.click(await screen.findByRole('button', { name: 'Account' }));

            await user.keyboard('{Escape}');

            expect(screen.queryByText('ann@example.com')).toBeNull();
        });

        it('signs out, and goes back to offering to sign in', async () => {
            const { api, user } = renderMenu(signedIn());
            await user.click(await screen.findByRole('button', { name: 'Account' }));

            await user.click(screen.getByRole('button', { name: 'Sign out' }));

            expect(api.logout).toHaveBeenCalled();
            expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
        });

        it('checks for unsaved changes before signing out', async () => {
            const guard = openGuard();
            guard.run.mockImplementation(() => {});
            const { api, user } = renderMenu(signedIn(), guard);
            await user.click(await screen.findByRole('button', { name: 'Account' }));

            await user.click(screen.getByRole('button', { name: 'Sign out' }));

            expect(guard.run).toHaveBeenCalled();
            expect(api.logout).not.toHaveBeenCalled();
        });

        it('stays signed in, and says why, when signing out fails', async () => {
            const api = createFakeAuthApi({
                me: vi.fn().mockResolvedValue(ann),
                logout: vi.fn().mockRejectedValue(new Error('Could not reach the server.')),
            });
            const { user } = renderMenu(api);
            await user.click(await screen.findByRole('button', { name: 'Account' }));

            await user.click(screen.getByRole('button', { name: 'Sign out' }));

            expect((await screen.findByRole('alert')).textContent).toBe('Could not reach the server.');
            expect(screen.getByText('ann@example.com')).toBeTruthy();
        });
    });
});