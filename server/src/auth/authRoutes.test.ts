import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessions, users } from '../db/schema';
import { TEST_SESSION_LIFETIME_MS, createTestApp } from '../test/createTestApp';

const graph = { directed: false, weighted: false, nodes: [{ id: 'a', x: 0, y: 0, label: 'A' }], edges: [] };
const savedGraph = {
    name: 'Mine',
    graph,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 0,
};

const ann = { email: 'ann@example.com', password: 'a long password' };

describe('authentication', () => {
    let testApp: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        testApp = createTestApp({ realAuthentication: true });
    });
    afterEach(() => testApp.close());

    // Pulls the session cookie out of a response, as the raw "name=value; flags" line.
    function sessionCookie(response: request.Response): string {
        const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
        const found = cookies?.find((cookie) => cookie.startsWith('gp_session='));
        if (!found) throw new Error('no session cookie was set');
        return found;
    }

    describe('POST /api/auth/register', () => {
        it('creates the account, signs the user in, and never sends the password hash back', async () => {
            const response = await request(testApp.app).post('/api/auth/register').send(ann);

            expect(response.status).toBe(201);
            expect(response.body).toEqual({ id: expect.any(String), email: 'ann@example.com' });
            expect(JSON.stringify(response.body)).not.toMatch(/hash|password/i);
        });

        it('sets a cookie that JavaScript cannot read and other sites cannot trigger', async () => {
            const response = await request(testApp.app).post('/api/auth/register').send(ann);
            const cookie = sessionCookie(response);

            expect(cookie).toMatch(/HttpOnly/i);
            expect(cookie).toMatch(/SameSite=Lax/i);
            expect(cookie).toMatch(/Path=\//);
            expect(cookie).toMatch(/Expires=/i);
        });

        it('hands the password to the hasher instead of storing it as typed', async () => {
            await request(testApp.app).post('/api/auth/register').send(ann);

            expect(testApp.hasherCalls.hash).toBe(1);
            const [row] = testApp.db.select().from(users).all().filter((u) => u.email === 'ann@example.com');
            expect(row.passwordHash).toBe('fake-hash:a long password'); // what the fake produces, not the bare password
            expect(row.passwordHash).not.toBe(ann.password);
        });

        it('makes the new user known to /me with the cookie it set', async () => {
            const agent = request.agent(testApp.app);
            await agent.post('/api/auth/register').send(ann);

            const me = await agent.get('/api/auth/me');
            expect(me.status).toBe(200);
            expect(me.body.email).toBe('ann@example.com');
        });

        it('treats the email case-insensitively, so one person cannot register twice', async () => {
            await request(testApp.app).post('/api/auth/register').send(ann);
            const again = await request(testApp.app)
                .post('/api/auth/register')
                .send({ email: '  ANN@Example.com ', password: 'another password' });

            expect(again.status).toBe(409);
            expect(again.body.error).toMatch(/already exists/);
        });

        it('rejects a bad email, a short password and missing fields, and says what is wrong', async () => {
            const badEmail = await request(testApp.app).post('/api/auth/register').send({ ...ann, email: 'nope' });
            const shortPassword = await request(testApp.app).post('/api/auth/register').send({ ...ann, password: 'short' });
            const empty = await request(testApp.app).post('/api/auth/register').send({});

            expect(badEmail.status).toBe(400);
            expect(badEmail.body.details.join(' ')).toContain('email');
            expect(shortPassword.status).toBe(400);
            expect(shortPassword.body.details.join(' ')).toContain('password');
            expect(empty.status).toBe(400);
            expect(testApp.db.select().from(sessions).all()).toHaveLength(0);
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await request(testApp.app).post('/api/auth/register').send(ann);
        });

        it('signs in with the right email and password, in any letter case for the email', async () => {
            const response = await request(testApp.app)
                .post('/api/auth/login')
                .send({ email: 'ANN@example.com', password: ann.password });

            expect(response.status).toBe(200);
            expect(response.body.email).toBe('ann@example.com');
            expect(sessionCookie(response)).toMatch(/HttpOnly/i);
        });

        it('gives the exact same answer for a wrong password and for an unknown email', async () => {
            const wrongPassword = await request(testApp.app)
                .post('/api/auth/login')
                .send({ email: ann.email, password: 'not the password' });
            const unknownEmail = await request(testApp.app)
                .post('/api/auth/login')
                .send({ email: 'nobody@example.com', password: 'not the password' });

            expect(wrongPassword.status).toBe(401);
            expect(unknownEmail.status).toBe(401);
            expect(unknownEmail.body).toEqual(wrongPassword.body);
            expect(wrongPassword.headers['set-cookie']).toBeUndefined();
            expect(unknownEmail.headers['set-cookie']).toBeUndefined();
        });

        it('does the same slow password check for an unknown email, so timing gives nothing away', async () => {
            const before = testApp.hasherCalls.verify;
            await request(testApp.app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever' });
            expect(testApp.hasherCalls.verify).toBe(before + 1);
        });

        it('rejects a request with missing fields', async () => {
            const response = await request(testApp.app).post('/api/auth/login').send({ email: ann.email });
            expect(response.status).toBe(400);
        });

        it('works from a different browser (a fresh agent) than the one that registered', async () => {
            const otherBrowser = request.agent(testApp.app);
            await otherBrowser.post('/api/auth/login').send(ann);
            expect((await otherBrowser.get('/api/auth/me')).status).toBe(200);
        });
    });

    describe('sessions', () => {
        it('rejects /me without a cookie, with a made-up cookie, and with an empty cookie', async () => {
            expect((await request(testApp.app).get('/api/auth/me')).status).toBe(401);
            expect((await request(testApp.app).get('/api/auth/me').set('Cookie', 'gp_session=made-up')).status).toBe(401);
            expect((await request(testApp.app).get('/api/auth/me').set('Cookie', 'gp_session=')).status).toBe(401);
        });

        it('stores only a fingerprint of the token in the database', async () => {
            const response = await request(testApp.app).post('/api/auth/register').send(ann);
            const token = sessionCookie(response).split(';')[0].replace('gp_session=', '');

            const [row] = testApp.db.select().from(sessions).all();
            expect(row.tokenHash).not.toBe(token);
            expect(JSON.stringify(row)).not.toContain(token);
        });

        it('stops working when it expires', async () => {
            const agent = request.agent(testApp.app);
            await agent.post('/api/auth/register').send(ann);
            expect((await agent.get('/api/auth/me')).status).toBe(200);

            testApp.advanceTime(TEST_SESSION_LIFETIME_MS + 1000);

            expect((await agent.get('/api/auth/me')).status).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('clears the cookie and ends the session on the server, so a stolen copy of the cookie stops working too', async () => {
            const registered = await request(testApp.app).post('/api/auth/register').send(ann);
            const cookieLine = sessionCookie(registered).split(';')[0];

            const loggedOut = await request(testApp.app).post('/api/auth/logout').set('Cookie', cookieLine);
            expect(loggedOut.status).toBe(204);
            expect(sessionCookie(loggedOut)).toMatch(/gp_session=;/);

            // Somebody who copied the cookie earlier replays it:
            const replay = await request(testApp.app).get('/api/auth/me').set('Cookie', cookieLine);
            expect(replay.status).toBe(401);
            expect(testApp.db.select().from(sessions).all()).toHaveLength(0);
        });

        it('is harmless when nobody is signed in', async () => {
            const response = await request(testApp.app).post('/api/auth/logout');
            expect(response.status).toBe(204);
        });

        it('only ends the session it was called with, not the same user\'s other sessions', async () => {
            const phone = request.agent(testApp.app);
            const laptop = request.agent(testApp.app);
            await phone.post('/api/auth/register').send(ann);
            await laptop.post('/api/auth/login').send(ann);

            await phone.post('/api/auth/logout');

            expect((await phone.get('/api/auth/me')).status).toBe(401);
            expect((await laptop.get('/api/auth/me')).status).toBe(200);
        });
    });

    describe('protecting the graph routes', () => {
        it('turns away every graph route when nobody is signed in', async () => {
            const attempts = [
                request(testApp.app).get('/api/graphs'),
                request(testApp.app).get('/api/graphs/g1'),
                request(testApp.app).put('/api/graphs/g1').send(savedGraph),
                request(testApp.app).delete('/api/graphs/g1'),
            ];
            for (const attempt of attempts) expect((await attempt).status).toBe(401);
        });

        it('keeps every account\'s graphs private, all the way through real sessions', async () => {
            const alice = request.agent(testApp.app);
            const bob = request.agent(testApp.app);
            await alice.post('/api/auth/register').send(ann);
            await bob.post('/api/auth/register').send({ email: 'bob@example.com', password: 'bobs long password' });

            await alice.put('/api/graphs/alices-graph').send(savedGraph).expect(201);

            expect((await alice.get('/api/graphs')).body).toHaveLength(1);
            expect((await bob.get('/api/graphs')).body).toEqual([]);
            expect((await bob.get('/api/graphs/alices-graph')).status).toBe(404);
            expect((await bob.delete('/api/graphs/alices-graph')).status).toBe(404);
            expect((await alice.get('/api/graphs/alices-graph')).status).toBe(200);
        });

        it('no longer lets a user in after logging out', async () => {
            const agent = request.agent(testApp.app);
            await agent.post('/api/auth/register').send(ann);
            expect((await agent.get('/api/graphs')).status).toBe(200);

            await agent.post('/api/auth/logout');

            expect((await agent.get('/api/graphs')).status).toBe(401);
        });

        it('leaves the health check open to everyone', async () => {
            expect((await request(testApp.app).get('/api/health')).status).toBe(200);
        });
    });
});

describe('rate limiting', () => {
    it('stops an endless stream of wrong passwords, but not a correct login', async () => {
        const testApp = createTestApp({ realAuthentication: true, authRateLimit: { windowMs: 60_000, limit: 3 } });
        await request(testApp.app).post('/api/auth/register').send(ann);

        const wrong = { email: ann.email, password: 'wrong password' };
        for (let attempt = 0; attempt < 3; attempt += 1) {
            expect((await request(testApp.app).post('/api/auth/login').send(wrong)).status).toBe(401);
        }

        const blocked = await request(testApp.app).post('/api/auth/login').send(wrong);
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toMatch(/Too many attempts/);

        // Even the right password is refused while the limit is in force, otherwise guessing would never be slowed down.
        expect((await request(testApp.app).post('/api/auth/login').send(ann)).status).toBe(429);
        testApp.close();
    });

    it('does not count successful logins against the limit', async () => {
        const testApp = createTestApp({ realAuthentication: true, authRateLimit: { windowMs: 60_000, limit: 3 } });
        await request(testApp.app).post('/api/auth/register').send(ann);

        for (let attempt = 0; attempt < 6; attempt += 1) {
            expect((await request(testApp.app).post('/api/auth/login').send(ann)).status).toBe(200);
        }
        testApp.close();
    });

    it('also limits how fast accounts can be created', async () => {
        const testApp = createTestApp({ realAuthentication: true, authRateLimit: { windowMs: 60_000, limit: 2 } });

        await request(testApp.app).post('/api/auth/register').send({ email: 'one@example.com', password: 'a long password' });
        await request(testApp.app).post('/api/auth/register').send({ email: 'two@example.com', password: 'a long password' });
        const third = await request(testApp.app).post('/api/auth/register').send({ email: 'three@example.com', password: 'a long password' });

        expect(third.status).toBe(429);
        testApp.close();
    });
});