import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../db/connection';
import { sessions as sessionsTable, users } from '../db/schema';
import { createSessionStore } from './sessionStore';

const HOUR = 60 * 60 * 1000;

describe('session store', () => {
    let database: ReturnType<typeof createDb>;
    let nowMs: number;
    let store: ReturnType<typeof createSessionStore>;
    let userId: string;

    beforeEach(() => {
        database = createDb(':memory:');
        nowMs = Date.UTC(2026, 0, 1);
        store = createSessionStore(database.db, { lifetimeMs: 10 * HOUR, now: () => new Date(nowMs) });
        [{ id: userId }] = database.db.insert(users).values({ email: 'a@b.c', passwordHash: 'x' }).returning().all();
    });
    afterEach(() => database.close());

    it('gives a long random token and finds the user by it', async () => {
        const session = await store.create(userId);
        expect(session.token.length).toBeGreaterThanOrEqual(43); // 32 bytes in base64url
        expect(await store.findUserId(session.token)).toBe(userId);
    });

    it('gives every session a different token', async () => {
        const first = await store.create(userId);
        const second = await store.create(userId);
        expect(second.token).not.toBe(first.token);
    });

    it('stores only a fingerprint of the token, never the token', async () => {
        const session = await store.create(userId);
        const [row] = database.db.select().from(sessionsTable).all();

        expect(row.tokenHash).not.toBe(session.token);
        expect(row.tokenHash).toBe(createHash('sha256').update(session.token).digest('hex'));
        expect(JSON.stringify(row)).not.toContain(session.token);
    });

    it('does not know a token it never issued', async () => {
        expect(await store.findUserId('made-up-token')).toBeNull();
        expect(await store.findUserId('')).toBeNull();
    });

    it('expires after its lifetime, and removes the expired row when it notices', async () => {
        const session = await store.create(userId);

        nowMs += 10 * HOUR - 1;
        expect(await store.findUserId(session.token)).toBe(userId);

        nowMs += 1;
        expect(await store.findUserId(session.token)).toBeNull();
        expect(database.db.select().from(sessionsTable).all()).toHaveLength(0);
    });

    it('delete ends the session', async () => {
        const session = await store.create(userId);
        await store.delete(session.token);
        expect(await store.findUserId(session.token)).toBeNull();
    });

    it('deleteExpired removes only the sessions that have expired', async () => {
        const old = await store.create(userId);
        nowMs += 6 * HOUR;
        const recent = await store.create(userId);
        nowMs += 5 * HOUR; // old is now 11 hours old, recent is 5

        expect(await store.deleteExpired()).toBe(1);
        expect(await store.findUserId(old.token)).toBeNull();
        expect(await store.findUserId(recent.token)).toBe(userId);
    });

    it('disappears together with the user', async () => {
        const session = await store.create(userId);
        database.db.delete(users).run();
        expect(await store.findUserId(session.token)).toBeNull();
    });
});