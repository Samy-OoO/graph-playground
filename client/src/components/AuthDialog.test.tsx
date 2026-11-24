// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../test/dialogPolyfill';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthApi, AuthOutcome } from '../auth/authApi';
import { ann, createFakeAuthApi } from '../auth/fakeAuthApi';
import { AuthDialog } from './AuthDialog';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

async function renderDialog(options: { api?: ReturnType<typeof createFakeAuthApi>; notice?: string | null; open?: boolean } = {}) {
    const api = options.api ?? createFakeAuthApi();
    const onClose = vi.fn();
    render(
        <AuthProvider api={api}>
            <AuthDialog open={options.open ?? true} notice={options.notice} onClose={onClose} />
        </AuthProvider>,
    );
    await waitFor(() => expect(api.me).toHaveBeenCalled());
    return { api, onClose, user: userEvent.setup() };
}

const email = () => screen.getByLabelText('Email') as HTMLInputElement;
const password = () => screen.getByLabelText('Password') as HTMLInputElement;

describe('AuthDialog', () => {
    it('shows nothing while closed', async () => {
        await renderDialog({ open: false });
        expect(screen.queryByLabelText('Email')).toBeNull();
    });

    it('opens on the sign-in form', async () => {
        await renderDialog();
        expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    });

    it('tells the browser which kind of password this is, so password managers behave', async () => {
        const { user } = await renderDialog();
        expect(password().autocomplete).toBe('current-password');
        expect(email().autocomplete).toBe('username');

        await user.click(screen.getByRole('button', { name: 'Create an account' }));
        expect(password().autocomplete).toBe('new-password');
    });

    it('signs in with the details cleaned up the way the server expects, then closes', async () => {
        const { api, onClose, user } = await renderDialog();

        await user.type(email(), '  Ann@Example.com ');
        await user.type(password(), 'a long password');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(api.login).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'a long password' });
    });

    it('explains a mistake without asking the server', async () => {
        const { api, onClose, user } = await renderDialog();

        await user.type(email(), 'not an email');
        await user.type(password(), 'x');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect((await screen.findByRole('alert')).textContent).toMatch(/valid email address/);
        expect(api.login).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('asks for a password when it is empty', async () => {
        const { api, user } = await renderDialog();
        await user.type(email(), 'ann@example.com');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect((await screen.findByRole('alert')).textContent).toMatch(/Enter your password/);
        expect(api.login).not.toHaveBeenCalled();
    });

    it('shows the server\'s refusal and stays open', async () => {
        const api = createFakeAuthApi({
            login: vi.fn().mockResolvedValue({ ok: false, message: 'Email or password is incorrect.' }),
        });
        const { onClose, user } = await renderDialog({ api });

        await user.type(email(), 'ann@example.com');
        await user.type(password(), 'wrong password');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect.');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not send twice while it is waiting for the server', async () => {
        let finish: (outcome: AuthOutcome) => void = () => {};
        const api = createFakeAuthApi({
            login: vi.fn<AuthApi['login']>(() => new Promise<AuthOutcome>((resolve) => (finish = resolve))),
        });
        const { user } = await renderDialog({ api });

        await user.type(email(), 'ann@example.com');
        await user.type(password(), 'a long password');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        const waiting = await screen.findByRole('button', { name: 'Please wait…' });
        expect((waiting as HTMLButtonElement).disabled).toBe(true);
        await user.click(waiting);
        expect(api.login).toHaveBeenCalledTimes(1);

        finish({ ok: true, user: ann });
    });

    describe('creating an account', () => {
        async function openRegister() {
            const context = await renderDialog();
            await context.user.click(screen.getByRole('button', { name: 'Create an account' }));
            return context;
        }

        it('switches the form and mentions the password length', async () => {
            await openRegister();
            expect(screen.getByRole('heading', { name: 'Create an account' })).toBeTruthy();
            expect(screen.getByText(/At least 8 characters/)).toBeTruthy();
            expect(screen.getByRole('button', { name: 'I already have an account' })).toBeTruthy();
        });

        it('applies the password rules that signing in does not', async () => {
            const { api, user } = await openRegister();

            await user.type(email(), 'ann@example.com');
            await user.type(password(), 'short');
            await user.click(screen.getByRole('button', { name: 'Create account' }));

            expect((await screen.findByRole('alert')).textContent).toMatch(/at least 8 characters/i);
            expect(api.register).not.toHaveBeenCalled();
        });

        it('registers and closes', async () => {
            const { api, onClose, user } = await openRegister();

            await user.type(email(), 'ann@example.com');
            await user.type(password(), 'a long password');
            await user.click(screen.getByRole('button', { name: 'Create account' }));

            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(api.register).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'a long password' });
        });

        it('keeps the email when switching back and forth, but clears an old message', async () => {
            const { user } = await openRegister();
            await user.type(email(), 'ann@example.com');
            await user.click(screen.getByRole('button', { name: 'Create account' }));
            await screen.findByRole('alert');

            await user.click(screen.getByRole('button', { name: 'I already have an account' }));

            expect(email().value).toBe('ann@example.com');
            expect(screen.queryByRole('alert')).toBeNull();
        });
    });

    it('shows why it opened, when it opened by itself', async () => {
        await renderDialog({ notice: 'Your session ended.' });
        expect(screen.getByRole('status').textContent).toBe('Your session ended.');
    });

    it('closes with Cancel', async () => {
        const { onClose, user } = await renderDialog();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
    });
});