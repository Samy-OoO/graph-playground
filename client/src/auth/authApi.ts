import { publicUserSchema } from '@graph-playground/shared';
import type { LoginInput, PublicUser, RegisterInput } from '@graph-playground/shared';

// Signing in or registering either works, or fails with a sentence to show on screen.
export type AuthOutcome = { ok: true; user: PublicUser } | { ok: false; message: string };

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const UNREACHABLE = 'Could not reach the server. Check your connection ans try again.'

// How long to wait before concluding the server is not there. The app has to start even when it is down.
const ME_TIMEOUT_MS = 5000;

// Reads the servee's { error } message out of a failed response, if there is one.
async function readError(response: Response): Promise<string> {
    try {
        const body = await response.json();
        if (typeof body?.error === 'string') return body.error;
    } catch {
        // The body was not JSON. The status code is all we have.
    }
    return `The server answered with an error (${response.status}).`;
}

// The /api/auth routes. Like ApiRepository, it is handed `fetch` so tests can use a fake.
export function createAuthApi(baseUrl = '/api', fetchFn: typeof fetch = (input, init) => fetch(input, init)) {
    async function send(path: string, init?: RequestInit): Promise<Response> {
        try {
            return await fetchFn(`${baseUrl}/auth${path}`, init);
        } catch (error) {
            throw new Error(UNREACHABLE, { cause: error });
        }
    }

    async function readUser(response: Response): Promise<PublicUser> {
        const parsed = publicUserSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('The server sent an answer that could not be read.');
        return parsed.data;
    }

    async function submit(path: '/login' | '/register', input: LoginInput | RegisterInput): Promise<AuthOutcome> {
        try {
            const response = await send(path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) });
            if (!response.ok) return { ok: false, message: await readError(response) };
            return { ok: true, user: await readUser(response) };
        } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : UNREACHABLE };
        }
    }

    return {
        // The signed-in user, or null when nobody is signed in. Throws when the server cannot be reached.
        async me(): Promise<PublicUser | null> {
            const response = await send('/me', { signal: AbortSignal.timeout(ME_TIMEOUT_MS) });
            if (response.status === 401) return null;
            if (!response.ok) throw new Error(await readError(response));
            return readUser(response);
        }, 

        register: (input: RegisterInput) => submit('/register', input), 
        login: (input: LoginInput) => submit('/login', input), 

        // Throws if the server could not be told, cuz then the session may still be alive.
        async logout(): Promise<void> {
            const response = await send('/logout', { method: 'POST' });
            if (!response.ok) throw new Error(await readError(response));
        },
    };
}

export type AuthApi = ReturnType<typeof createAuthApi>;