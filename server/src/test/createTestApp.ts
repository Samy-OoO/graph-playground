import { createApp } from '../app';
import { createAuthService } from '../auth/authService';
import type { PasswordHasher } from '../auth/passwordHasher';
import { requireUser } from '../auth/requireUser';
import { createSessionStore } from '../auth/sessionStore';
import { createUserRepository } from '../auth/userRepository';
import { createDb } from '../db/connection';
import { users } from '../db/schema';
import { createGraphRepository } from '../graphs/sqliteGraphRepository';
import { fixedUser } from './fixedUser';

export const TEST_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

type Options = {
    // false (the default): every request is "me", no login needed. true: the real cookie sessions.
    realAuthentication?: boolean;
    authRateLimit?: { windowMs: number; limit: number };
};

// A complete app on a throwaway in-memory database, plus two users: the one making requests, and someone else.
export function createTestApp(options: Options = {}) {
    const database = createDb(':memory:');

    // Real argon2 takes about 200 ms per password, which adds up over dozens of tests. This fake is instant
    // and counts how often it is used. The real hasher has its own tests.
    const hasherCalls = { hash: 0, verify: 0 };
    const hasher: PasswordHasher = {
        hash: async (plain) => {
            hasherCalls.hash += 1;
            return `fake-hash:${plain}`;
        },
        verify: async (hash, plain) => {
            hasherCalls.verify += 1;
            return hash === `fake-hash:${plain}`;
        },
    };

    // A clock the tests can move forward, to see sessions expire. It starts at the real time, because the
    // cookie jar in the tests (like a browser) compares the cookie's expiry date with the real clock.
    let nowMs = Date.now();
    const sessions = createSessionStore(database.db, {
        lifetimeMs: TEST_SESSION_LIFETIME_MS,
        now: () => new Date(nowMs),
    });
    const auth = createAuthService({ users: createUserRepository(database.db), sessions, hasher });

    const [me, other] = database.db
        .insert(users)
        .values([
            { email: 'me@example.com', passwordHash: 'x' },
            { email: 'other@example.com', passwordHash: 'x' },
        ])
        .returning()
        .all();

    const graphs = createGraphRepository(database.db);
    const app = createApp({
        graphs,
        auth,
        authenticate: options.realAuthentication ? requireUser(auth) : fixedUser(me.id),
        secureCookies: false,
        authRateLimit: options.authRateLimit ?? { windowMs: 60_000, limit: 1000 },
    });

    return {
        app,
        graphs,
        db: database.db,
        sessions,
        hasherCalls,
        myId: me.id,
        otherId: other.id,
        advanceTime: (ms: number) => {
            nowMs += ms;
        },
        close: database.close,
    };
}