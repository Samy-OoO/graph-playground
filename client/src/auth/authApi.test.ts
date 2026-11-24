import { describe, expect, it, vi } from 'vitest';
import { createAuthApi } from './authApi';

const ann = { id: 'user-ann', email: 'ann@example.com' };

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// An AuthApi whose "network" always answers with the given response (or fails, if given an error).
function apiAnswering(answer: Response | Error) {
    const fetchFn = vi.fn<typeof fetch>(async () => {
        if (answer instanceof Error) throw answer;
        return answer;
    });
    return { api: createAuthApi('/api', fetchFn), fetchFn };
}

describe('createAuthApi', () => {
    describe('me', () => {
        it('returns the signed-in user', async () => {
            const { api, fetchFn } = apiAnswering(json(200, ann));
            expect(await api.me()).toEqual(ann);
            expect(fetchFn.mock.calls[0][0]).toBe('/api/auth/me');
        });

        it('returns null when nobody is signed in', async () => {
            const { api } = apiAnswering(json(401, { error: 'You need to sign in.' }));
            expect(await api.me()).toBeNull();
        });

        it('gives up waiting for a server that does not answer', async () => {
            const { api, fetchFn } = apiAnswering(json(200, ann));
            await api.me();
            const init = fetchFn.mock.calls[0][1];
            expect(init?.signal).toBeInstanceOf(AbortSignal);
        });

        it('throws when the server cannot be reached, so the caller can tell that apart from "not signed in"', async () => {
            const { api } = apiAnswering(new TypeError('Failed to fetch'));
            await expect(api.me()).rejects.toThrow(/Could not reach the server/);
        });

        it('throws for a server error', async () => {
            const { api } = apiAnswering(json(500, { error: 'Something went wrong on the server.' }));
            await expect(api.me()).rejects.toThrow('Something went wrong on the server.');
        });

        it('refuses an answer that is not a user', async () => {
            const { api } = apiAnswering(json(200, { hello: 'world' }));
            await expect(api.me()).rejects.toThrow(/could not be read/);
        });
    });

    describe.each([
        ['login', '/api/auth/login'],
        ['register', '/api/auth/register'],
    ] as const)('%s', (method, url) => {
        const credentials = { email: 'ann@example.com', password: 'a long password' };

        it('sends the details as JSON and returns the user', async () => {
            const { api, fetchFn } = apiAnswering(json(200, ann));

            const outcome = await api[method](credentials);

            expect(outcome).toEqual({ ok: true, user: ann });
            const [calledUrl, init] = fetchFn.mock.calls[0];
            expect(calledUrl).toBe(url);
            expect(init?.method).toBe('POST');
            expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
            expect(JSON.parse(init?.body as string)).toEqual(credentials);
        });

        it('hands back the server\'s own message when it refuses', async () => {
            const { api } = apiAnswering(json(401, { error: 'Email or password is incorrect.' }));
            expect(await api[method](credentials)).toEqual({ ok: false, message: 'Email or password is incorrect.' });
        });

        it('explains when the server cannot be reached, instead of throwing', async () => {
            const { api } = apiAnswering(new TypeError('Failed to fetch'));
            const outcome = await api[method](credentials);
            expect(outcome.ok).toBe(false);
            expect(!outcome.ok && outcome.message).toMatch(/Could not reach the server/);
        });

        it('copes with an error that is not JSON', async () => {
            const { api } = apiAnswering(new Response('Bad gateway', { status: 502 }));
            expect(await api[method](credentials)).toEqual({
                ok: false,
                message: 'The server answered with an error (502).',
            });
        });

        it('does not treat an unreadable success answer as signed in', async () => {
            const { api } = apiAnswering(json(200, { nope: true }));
            expect((await api[method](credentials)).ok).toBe(false);
        });
    });

    describe('logout', () => {
        it('tells the server', async () => {
            const { api, fetchFn } = apiAnswering(new Response(null, { status: 204 }));
            await api.logout();
            expect(fetchFn.mock.calls[0][0]).toBe('/api/auth/logout');
            expect(fetchFn.mock.calls[0][1]?.method).toBe('POST');
        });

        it('throws when the server could not be told, because the session may still be alive', async () => {
            const { api } = apiAnswering(new TypeError('Failed to fetch'));
            await expect(api.logout()).rejects.toThrow(/Could not reach the server/);
        });
    });
});