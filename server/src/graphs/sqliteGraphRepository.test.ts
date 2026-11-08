import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../db/connection';
import { users } from '../db/schema';
import { createGraphRepository } from './sqliteGraphRepository';
import type { GraphInput } from './types';

function makeInput(name: string, nodeCount = 2): GraphInput {
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}`, x: i * 50, y: 0, label: `N${i}` }));
    const edges = nodeCount >= 2 ? [{ id: 'e0', source: 'n0', destination: 'n1' }] : [];
    return { name, graph: { directed: false, weighted: false, nodes, edges } };
}

describe('graph repository', () => {
    let database: ReturnType<typeof createDb>;
    let time: number;
    let repo: ReturnType<typeof createGraphRepository>;
    let alice: string;
    let bob: string;

    // Every call to the clock moves one second forward, so "most recent" is always clear.
    const clock = () => new Date(Date.UTC(2026, 0, 1, 0, 0, time++)).toISOString();

    beforeEach(() => {
        database = createDb(':memory:');
        time = 0;
        repo = createGraphRepository(database.db, clock);
        const [a, b] = database.db
            .insert(users)
            .values([
                { email: 'alice@example.com', passwordHash: 'x' },
                { email: 'bob@example.com', passwordHash: 'x' },
            ])
            .returning()
            .all();
        alice = a.id;
        bob = b.id;
    });
    afterEach(() => database.close());

    describe('create and get', () => {
        it('creates a graph with a server-made id and revision 1', async () => {
            const created = await repo.create(alice, makeInput('Triangle'));
            expect(created.id).toBeTruthy();
            expect(created.name).toBe('Triangle');
            expect(created.revision).toBe(1);
            expect(created.createdAt).toBe(created.updatedAt);
            expect(await repo.get(alice, created.id)).toEqual(created);
        });

        it('returns null for an id that does not exist', async () => {
            expect(await repo.get(alice, 'nope')).toBeNull();
        });

        it('does not let another user read the graph', async () => {
            const created = await repo.create(alice, makeInput('Private'));
            expect(await repo.get(bob, created.id)).toBeNull();
        });
    });

    describe('list', () => {
        it('lists only the user\'s own graphs, most recently updated first', async () => {
            const first = await repo.create(alice, makeInput('First'));
            await repo.create(alice, makeInput('Second', 3));
            await repo.create(bob, makeInput('Bob\'s'));
            await repo.update(alice, first.id, makeInput('First, edited'), 1);

            const list = await repo.list(alice);
            expect(list.map((g) => g.name)).toEqual(['First, edited', 'Second']);
        });

        it('reports node and edge counts without sending the graph', async () => {
            await repo.create(alice, makeInput('Three nodes', 3));
            const [summary] = await repo.list(alice);
            expect(summary.nodeCount).toBe(3);
            expect(summary.edgeCount).toBe(1);
            expect(summary).not.toHaveProperty('graph');
        });
    });

    describe('update', () => {
        it('saves with the right revision and raises it by one', async () => {
            const created = await repo.create(alice, makeInput('Old name'));
            const result = await repo.update(alice, created.id, makeInput('New name', 3), 1);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.graph.revision).toBe(2);
            expect(result.graph.name).toBe('New name');
            expect(result.graph.graph.nodes).toHaveLength(3);
            expect(result.graph.createdAt).toBe(created.createdAt);
            expect(result.graph.updatedAt > created.updatedAt).toBe(true);
            expect(await repo.get(alice, created.id)).toEqual(result.graph);
        });

        it('refuses a stale revision and returns what is stored now', async () => {
            const created = await repo.create(alice, makeInput('Original'));
            await repo.update(alice, created.id, makeInput('Tab one wins'), 1);

            // Tab two still believes the revision is 1.
            const result = await repo.update(alice, created.id, makeInput('Tab two loses'), 1);

            expect(result.ok).toBe(false);
            if (result.ok || result.reason !== 'conflict') throw new Error('expected a conflict');
            expect(result.current.name).toBe('Tab one wins');
            expect(result.current.revision).toBe(2);
            expect((await repo.get(alice, created.id))?.name).toBe('Tab one wins');
        });

        it('reports not_found for an unknown id', async () => {
            const result = await repo.update(alice, 'nope', makeInput('x'), 1);
            expect(result).toEqual({ ok: false, reason: 'not_found' });
        });

        it('treats another user\'s graph as not_found and leaves it untouched', async () => {
            const created = await repo.create(alice, makeInput('Alice\'s'));
            const result = await repo.update(bob, created.id, makeInput('Hijacked'), 1);

            expect(result).toEqual({ ok: false, reason: 'not_found' });
            expect((await repo.get(alice, created.id))?.name).toBe('Alice\'s');
        });
    });

    describe('delete', () => {
        it('removes the graph', async () => {
            const created = await repo.create(alice, makeInput('Temporary'));
            expect(await repo.delete(alice, created.id)).toBe(true);
            expect(await repo.get(alice, created.id)).toBeNull();
        });

        it('returns false when there is nothing to delete', async () => {
            expect(await repo.delete(alice, 'nope')).toBe(false);
        });

        it('does not let another user delete the graph', async () => {
            const created = await repo.create(alice, makeInput('Keep me'));
            expect(await repo.delete(bob, created.id)).toBe(false);
            expect(await repo.get(alice, created.id)).not.toBeNull();
        });
    });
});