import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './connection';
import { graphs, users } from './schema';

const sampleGraph = {
    directed: false,
    weighted: false,
    nodes: [
        { id: 'a', x: 0, y: 0, label: 'A' },
        { id: 'b', x: 100, y: 0, label: 'B' },
    ],
    edges: [{ id: 'e1', source: 'a', destination: 'b' }],
};

describe('database', () => {
    let database: ReturnType<typeof createDb>;

    // A fresh in-memory database for every test, so tests never affect each other.
    beforeEach(() => {
        database = createDb(':memory:');
    });
    afterEach(() => database.close());

    it('stores a graph and gives its JSON back as an object', () => {
        const { db } = database;
        const [user] = db.insert(users).values({ email: 'a@b.c', passwordHash: 'x' }).returning().all();

        const [saved] = db
            .insert(graphs)
            .values({ ownerId: user.id, name: 'Triangle', data: sampleGraph, schemaVersion: 1 })
            .returning()
            .all();

        const found = db.select().from(graphs).where(eq(graphs.id, saved.id)).get();
        expect(found?.data).toEqual(sampleGraph);
        expect(found?.revision).toBe(1);
        expect(found?.isPublic).toBe(false);
    });

    it('rejects a graph whose owner does not exist', () => {
        const { db } = database;
        expect(() =>
            db.insert(graphs).values({ ownerId: 'nobody', name: 'x', data: sampleGraph, schemaVersion: 1 }).run(),
        ).toThrow();
    });

    it('rejects two users with the same email', () => {
        const { db } = database;
        db.insert(users).values({ email: 'a@b.c', passwordHash: 'x' }).run();
        expect(() => db.insert(users).values({ email: 'a@b.c', passwordHash: 'y' }).run()).toThrow();
    });

    it('deletes a user\'s graphs together with the user', () => {
        const { db } = database;
        const [user] = db.insert(users).values({ email: 'a@b.c', passwordHash: 'x' }).returning().all();
        db.insert(graphs).values({ ownerId: user.id, name: 'x', data: sampleGraph, schemaVersion: 1 }).run();

        db.delete(users).where(eq(users.id, user.id)).run();

        expect(db.select().from(graphs).all()).toHaveLength(0);
    });
});