import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRepository } from './apiRepository';
import { ConflictError } from './conflictError';
import { createDocument } from './convert';
import { createFakeGraphServer } from './fakeGraphServer';
import { describeRepositoryContract } from './repositoryContract';

// The same tests every other repository passes. Each test gets a brand-new fake server, so it starts empty.
describeRepositoryContract('ApiRepository', () => new ApiRepository('/api', createFakeGraphServer().fetchFn));

function makeDoc(id: string, name: string, when = '2026-10-31T09:00:00.000Z') {
    return createDocument(
        { directed: true, weighted: false, nodes: [{ id: 'a', x: 1, y: 1, label: 'A' }], edges: [] },
        name,
        id,
        new Date(when),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ApiRepository specifics', () => {
    describe('revisions', () => {
        it('saves a new graph as revision 0, then sends the revision the server gave back', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);

            await repository.save(makeDoc('g1', 'First'));
            await repository.save(makeDoc('g1', 'Second', '2026-10-31T10:00:00.000Z'));
            await repository.save(makeDoc('g1', 'Third', '2026-10-31T11:00:00.000Z'));

            const sent = server.requests.filter((r) => r.method === 'PUT').map((r) => r.body?.revision);
            expect(sent).toEqual([0, 1, 2]);
        });

        it('uses the revision it learned from get()', async () => {
            const server = createFakeGraphServer();
            await new ApiRepository('/api', server.fetchFn).save(makeDoc('g1', 'Created elsewhere'));

            // A fresh repository, like a new page load.
            const repository = new ApiRepository('/api', server.fetchFn);
            const opened = await repository.get('g1');
            await repository.save({ ...opened!, name: 'Edited', updatedAt: '2026-10-31T10:00:00.000Z' });

            expect(server.stored.get('g1')?.name).toBe('Edited');
            expect(server.stored.get('g1')?.revision).toBe(2);
        });

        it('uses the revisions it learned from list()', async () => {
            const server = createFakeGraphServer();
            await new ApiRepository('/api', server.fetchFn).save(makeDoc('g1', 'Created elsewhere'));

            const repository = new ApiRepository('/api', server.fetchFn);
            await repository.list();
            await repository.save(makeDoc('g1', 'Edited', '2026-10-31T10:00:00.000Z'));

            expect(server.stored.get('g1')?.revision).toBe(2);
        });
    });

    describe('conflicts (two tabs)', () => {
        async function twoTabs() {
            const server = createFakeGraphServer();
            const tabOne = new ApiRepository('/api', server.fetchFn);
            const tabTwo = new ApiRepository('/api', server.fetchFn);

            await tabOne.save(makeDoc('g1', 'Original'));
            await tabOne.get('g1');
            await tabTwo.get('g1');
            return { server, tabOne, tabTwo };
        }

        it('throws a ConflictError carrying the winning version, and keeps the server unchanged', async () => {
            const { server, tabOne, tabTwo } = await twoTabs();
            await tabOne.save(makeDoc('g1', 'Tab one wins', '2026-10-31T10:00:00.000Z'));

            const attempt = tabTwo.save(makeDoc('g1', 'Tab two loses', '2026-10-31T11:00:00.000Z'));

            await expect(attempt).rejects.toBeInstanceOf(ConflictError);
            await expect(attempt).rejects.toMatchObject({ current: { name: 'Tab one wins' } });
            expect(server.stored.get('g1')?.name).toBe('Tab one wins');
        });

        it('keeps refusing until the caller reloads, so nothing is overwritten by accident', async () => {
            const { tabOne, tabTwo } = await twoTabs();
            await tabOne.save(makeDoc('g1', 'Tab one wins', '2026-10-31T10:00:00.000Z'));

            await expect(tabTwo.save(makeDoc('g1', 'Try 1', '2026-10-31T11:00:00.000Z'))).rejects.toBeInstanceOf(ConflictError);
            await expect(tabTwo.save(makeDoc('g1', 'Try 2', '2026-10-31T11:30:00.000Z'))).rejects.toBeInstanceOf(ConflictError);
        });

        it('lets the user keep their own version by loading the latest first, then saving', async () => {
            const { server, tabOne, tabTwo } = await twoTabs();
            await tabOne.save(makeDoc('g1', 'Tab one wins', '2026-10-31T10:00:00.000Z'));
            await expect(tabTwo.save(makeDoc('g1', 'Mine', '2026-10-31T11:00:00.000Z'))).rejects.toBeInstanceOf(ConflictError);

            await tabTwo.get('g1'); // adopts the server's current revision
            await tabTwo.save(makeDoc('g1', 'Mine', '2026-10-31T11:00:00.000Z'));

            expect(server.stored.get('g1')?.name).toBe('Mine');
        });

        it('reports a conflict when a graph this repository thought was new already exists', async () => {
            const server = createFakeGraphServer();
            await new ApiRepository('/api', server.fetchFn).save(makeDoc('g1', 'Already there'));

            const stranger = new ApiRepository('/api', server.fetchFn);
            await expect(stranger.save(makeDoc('g1', 'Overwrite attempt'))).rejects.toBeInstanceOf(ConflictError);
            expect(server.stored.get('g1')?.name).toBe('Already there');
        });
    });

    describe('when the graph is gone', () => {
        it('explains that it was deleted elsewhere, and recreates it on the next save', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);
            await repository.save(makeDoc('g1', 'First'));

            server.stored.delete('g1'); // deleted from another device

            await expect(repository.save(makeDoc('g1', 'Second', '2026-10-31T10:00:00.000Z'))).rejects.toThrow(/deleted somewhere else/);
            await repository.save(makeDoc('g1', 'Second', '2026-10-31T10:00:00.000Z'));
            expect(server.stored.get('g1')?.name).toBe('Second');
        });

        it('get returns null for an unknown graph', async () => {
            const repository = new ApiRepository('/api', createFakeGraphServer().fetchFn);
            expect(await repository.get('nope')).toBeNull();
        });
    });

    describe('failures', () => {
        it('explains when the server cannot be reached', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);
            server.goOffline();

            await expect(repository.list()).rejects.toThrow(/Could not reach the server/);
            await expect(repository.save(makeDoc('g1', 'x'))).rejects.toThrow(/Could not reach the server/);
        });

        it('passes on the server\'s own error message', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);

            server.answerNextWith(400, { error: 'The graph is not valid.' });
            await expect(repository.save(makeDoc('g1', 'x'))).rejects.toThrow('The graph is not valid.');
        });

        it('copes with an error that is not JSON', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);

            server.answerNextWith(500);
            await expect(repository.get('g1')).rejects.toThrow('The server answered with an error (500).');
        });

        it('refuses to read a graph from the server that breaks the rules', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);
            await repository.save(makeDoc('g1', 'Fine'));
            server.stored.get('g1')!.graph = { directed: true, weighted: false, nodes: [], edges: [{ id: 'e', source: 'x', destination: 'y' }] };

            await expect(repository.get('g1')).rejects.toThrow(/could not be read/);
        });

        it('skips an unreadable graph in the list instead of failing the whole list', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);
            await repository.save(makeDoc('good', 'Good'));
            await repository.save(makeDoc('bad', 'Bad'));
            server.stored.get('bad')!.name = '';

            const list = await repository.list();
            expect(list.map((s) => s.id)).toEqual(['good']);
        });
    });

    describe('requests', () => {
        it('encodes ids that contain special characters', async () => {
            const server = createFakeGraphServer();
            const repository = new ApiRepository('/api', server.fetchFn);

            await repository.save(makeDoc('a/b ?c', 'Odd id'));

            expect(server.requests[0].path).toBe('/api/graphs/a%2Fb%20%3Fc');
            expect(server.stored.has('a/b ?c')).toBe(true);
        });

        it('sends only what the server accepts, with the id in the URL and not the body', async () => {
            const server = createFakeGraphServer();
            await new ApiRepository('/api', server.fetchFn).save(makeDoc('g1', 'First'));

            expect(Object.keys(server.requests[0].body ?? {}).sort()).toEqual(
                ['createdAt', 'graph', 'name', 'revision', 'updatedAt'],
            );
        });

        it('uses the real fetch when none is given', async () => {
            const server = createFakeGraphServer();
            const spy = vi.fn(server.fetchFn);
            vi.stubGlobal('fetch', spy);

            await new ApiRepository().list();

            expect(spy).toHaveBeenCalledWith('/api/graphs', undefined);
        });
    });
});