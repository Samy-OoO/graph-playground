import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../db/connection';
import { users } from '../db/schema';
import { createGraphRepository } from './sqliteGraphRepository';
import type { GraphInput } from './types';

// Timestamps are chosen by the client, so tests simply pick them.
function makeInput(id: string, name: string, updatedAt = '2026-01-01T00:00:00.000Z', nodeCount = 2): GraphInput {
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}`, x: i * 50, y: 0, label: `N${i}` }));
    const edges = nodeCount >= 2 ? [{ id: 'e0', source: 'n0', destination: 'n1' }] : [];
    return {
        id,
        name,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt,
        graph: { directed: false, weighted: false, nodes, edges },
    };
}

describe('graph repository', () => {
    let database: ReturnType<typeof createDb>;
    let repo: ReturnType<typeof createGraphRepository>;
    let alice: string;
    let bob: string;

    beforeEach(() => {
        database = createDb(':memory:');
        repo = createGraphRepository(database.db);
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

    describe('saving a new graph (revision 0)', () => {
        it('stores it with the client\'s id and timestamps, at revision 1', async () => {
            const result = await repo.save(alice, makeInput('g1', 'Triangle', '2026-02-02T00:00:00.000Z'), 0);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.graph.id).toBe('g1');
            expect(result.graph.revision).toBe(1);
            expect(result.graph.createdAt).toBe('2026-01-01T00:00:00.000Z');
            expect(result.graph.updatedAt).toBe('2026-02-02T00:00:00.000Z');
            expect(await repo.get(alice, 'g1')).toEqual(result.graph);
        });

        it('reports a conflict if the id already exists, and leaves the stored graph alone', async () => {
            await repo.save(alice, makeInput('g1', 'Original'), 0);
            const result = await repo.save(alice, makeInput('g1', 'Overwrite attempt'), 0);

            expect(result.ok).toBe(false);
            if (result.ok || result.reason !== 'conflict') throw new Error('expected a conflict');
            expect(result.current.name).toBe('Original');
            expect((await repo.get(alice, 'g1'))?.name).toBe('Original');
        });

        it('lets two users use the same id without affecting each other', async () => {
            await repo.save(alice, makeInput('same-id', 'Alice\'s'), 0);
            const bobResult = await repo.save(bob, makeInput('same-id', 'Bob\'s'), 0);

            expect(bobResult.ok).toBe(true);
            expect((await repo.get(alice, 'same-id'))?.name).toBe('Alice\'s');
            expect((await repo.get(bob, 'same-id'))?.name).toBe('Bob\'s');
        });
    });

    describe('get and list', () => {
        it('returns null for an id that does not exist', async () => {
            expect(await repo.get(alice, 'nope')).toBeNull();
        });

        it('does not let another user read the graph', async () => {
            await repo.save(alice, makeInput('g1', 'Private'), 0);
            expect(await repo.get(bob, 'g1')).toBeNull();
        });

        it('lists only the user\'s own graphs, most recently updated first, with their content', async () => {
            await repo.save(alice, makeInput('old', 'Older', '2026-01-01T00:00:00.000Z'), 0);
            await repo.save(alice, makeInput('new', 'Newer', '2026-03-01T00:00:00.000Z', 3), 0);
            await repo.save(bob, makeInput('bobs', 'Bob\'s'), 0);

            const list = await repo.list(alice);
            expect(list.map((g) => g.name)).toEqual(['Newer', 'Older']);
            expect(list[0].graph.nodes).toHaveLength(3);
        });
    });

    describe('replacing an existing graph', () => {
        it('saves with the right revision and raises it by one', async () => {
            await repo.save(alice, makeInput('g1', 'Old name'), 0);
            const edit = { ...makeInput('g1', 'New name', '2026-05-05T00:00:00.000Z', 3), createdAt: '1999-01-01T00:00:00.000Z' };

            const result = await repo.save(alice, edit, 1);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.graph.revision).toBe(2);
            expect(result.graph.name).toBe('New name');
            expect(result.graph.graph.nodes).toHaveLength(3);
            expect(result.graph.updatedAt).toBe('2026-05-05T00:00:00.000Z');
            // The creation time is set once and never rewritten, whatever the client sends later.
            expect(result.graph.createdAt).toBe('2026-01-01T00:00:00.000Z');
            expect(await repo.get(alice, 'g1')).toEqual(result.graph);
        });

        it('refuses a stale revision and returns what is stored now', async () => {
            await repo.save(alice, makeInput('g1', 'Original'), 0);
            await repo.save(alice, makeInput('g1', 'Tab one wins'), 1);

            // Tab two still believes the revision is 1.
            const result = await repo.save(alice, makeInput('g1', 'Tab two loses'), 1);

            expect(result.ok).toBe(false);
            if (result.ok || result.reason !== 'conflict') throw new Error('expected a conflict');
            expect(result.current.name).toBe('Tab one wins');
            expect(result.current.revision).toBe(2);
            expect((await repo.get(alice, 'g1'))?.name).toBe('Tab one wins');
        });

        it('reports not_found when the graph was deleted in the meantime', async () => {
            const result = await repo.save(alice, makeInput('gone', 'x'), 3);
            expect(result).toEqual({ ok: false, reason: 'not_found' });
        });

        it('treats another user\'s graph as not_found and leaves it untouched', async () => {
            await repo.save(alice, makeInput('g1', 'Alice\'s'), 0);
            const result = await repo.save(bob, makeInput('g1', 'Hijacked'), 1);

            expect(result).toEqual({ ok: false, reason: 'not_found' });
            expect((await repo.get(alice, 'g1'))?.name).toBe('Alice\'s');
        });
    });

    describe('delete', () => {
        it('removes the graph', async () => {
            await repo.save(alice, makeInput('g1', 'Temporary'), 0);
            expect(await repo.delete(alice, 'g1')).toBe(true);
            expect(await repo.get(alice, 'g1')).toBeNull();
        });

        it('returns false when there is nothing to delete', async () => {
            expect(await repo.delete(alice, 'nope')).toBe(false);
        });

        it('does not let another user delete the graph', async () => {
            await repo.save(alice, makeInput('g1', 'Keep me'), 0);
            expect(await repo.delete(bob, 'g1')).toBe(false);
            expect(await repo.get(alice, 'g1')).not.toBeNull();
        });
    });
});