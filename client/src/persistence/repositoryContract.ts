import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from './convert';
import type { GraphRepository } from './repository';
import type { GraphDocument } from './schema';

function makeDocument(id: string, name: string, when: string): GraphDocument {
    return createDocument(
        {
            directed: true,
            weighted: false,
            nodes: [
                { id: 'a', x: 10, y: 10, label: 'A' },
                { id: 'b', x: 50, y: 50, label: 'B' },
            ],
            edges: [{ id: 'e1', source: 'a', destination: 'b' }],
        },
        name,
        id,
        new Date(when),
    );
}


// The tests every GraphRepository must pass. Give it a function that creates a fresh, EMPTY repository; it is called before every test.
export function describeRepositoryContract(name: string, createRepository: () => GraphRepository | Promise<GraphRepository>) {
    describe(`${name} (repository contract)`, () => {
        let repository: GraphRepository;
    
        beforeEach(async () => {
        repository = await createRepository();
        });

        it('starts empty', async () => {
        expect(await repository.list()).toEqual([]);
        });

        it('returns null for a graph that does not exist', async () => {
        expect(await repository.get('nope')).toBeNull();
        });

        it('gets back exactly what was saved', async () => {
        const doc = makeDocument('d1', 'First', '2026-10-31T09:00:00.000Z');
        await repository.save(doc);
        expect(await repository.get('d1')).toEqual(doc);
        });

        it('replaces a graph saved again with the same id', async () => {
        await repository.save(makeDocument('d1', 'Old name', '2026-10-31T09:00:00.000Z'));
        await repository.save(makeDocument('d1', 'New name', '2026-10-31T10:00:00.000Z'));

        const summaries = await repository.list();
        expect(summaries).toHaveLength(1);
        expect(summaries[0].name).toBe('New name');
        });

        it('lists summaries with counts, not whole graphs', async () => {
        await repository.save(makeDocument('d1', 'First', '2026-10-31T09:00:00.000Z'));
        const [summary] = await repository.list();
        expect(summary).toMatchObject({ id: 'd1', name: 'First', nodeCount: 2, edgeCount: 1 });
        expect(summary).not.toHaveProperty('graph');
        });

        it('lists the most recently updated graph first', async () => {
        await repository.save(makeDocument('old', 'Old', '2026-10-30T09:00:00.000Z'));
        await repository.save(makeDocument('new', 'New', '2026-10-31T09:00:00.000Z'));
        await repository.save(makeDocument('mid', 'Mid', '2026-10-30T18:00:00.000Z'));

        const ids = (await repository.list()).map((summary) => summary.id);
        expect(ids).toEqual(['new', 'mid', 'old']);
        });

        it('deletes a graph', async () => {
        await repository.save(makeDocument('d1', 'First', '2026-10-31T09:00:00.000Z'));
        await repository.delete('d1');
        expect(await repository.get('d1')).toBeNull();
        expect(await repository.list()).toEqual([]);
        });

        it('does nothing when deleting a graph that does not exist', async () => {
        await expect(repository.delete('nope')).resolves.toBeUndefined();
        });

        it('is not affected by changes made to a document after saving it', async () => {
        const doc = makeDocument('d1', 'First', '2026-10-31T09:00:00.000Z');
        await repository.save(doc);
        doc.name = 'Changed afterwards';
        doc.graph.nodes.push({ id: 'c', x: 1, y: 1, label: 'C' });

        const stored = await repository.get('d1');
        expect(stored?.name).toBe('First');
        expect(stored?.graph.nodes).toHaveLength(2);
        });

        it('refuses to store a graph that breaks the rules, and says why', async () => {
            const broken = makeDocument('d1', 'Broken', '2026-10-31T09:00:00.000Z');
            broken.graph.edges.push({ id: 'e2', source: 'a', destination: 'ghost' });

            await expect(repository.save(broken)).rejects.toThrow(/cannot be saved.*graph\.edges\[1\]/);
            expect(await repository.list()).toEqual([]);
        });
        it('is not affected by changes made to a document it returned', async () => {
        await repository.save(makeDocument('d1', 'First', '2026-10-31T09:00:00.000Z'));
        const first = await repository.get('d1');
        if (first) first.name = 'Changed afterwards';

        const second = await repository.get('d1');
        expect(second?.name).toBe('First');
        });
    });
}