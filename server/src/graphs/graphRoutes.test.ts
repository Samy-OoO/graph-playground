import request from 'supertest';
import { LIMITS } from '@graph-playground/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../test/createTestApp';

const graph = {
    directed: false,
    weighted: false,
    nodes: [
        { id: 'a', x: 0, y: 0, label: 'A' },
        { id: 'b', x: 100, y: 0, label: 'B' },
    ],
    edges: [{ id: 'e1', source: 'a', destination: 'b' }],
};

// A complete, valid request body. Tests change only the part they care about.
function body(overrides: Record<string, unknown> = {}) {
    return {
        name: 'Triangle',
        graph,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        revision: 0,
        ...overrides,
    };
}

describe('/api/graphs', () => {
    let testApp: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        testApp = createTestApp();
    });
    afterEach(() => testApp.close());

    describe('PUT /api/graphs/:id with revision 0 (a new graph)', () => {
        it('creates the graph under the id in the URL and answers 201', async () => {
            const response = await request(testApp.app).put('/api/graphs/my-graph').send(body());

            expect(response.status).toBe(201);
            expect(response.body.id).toBe('my-graph');
            expect(response.body.name).toBe('Triangle');
            expect(response.body.revision).toBe(1);
            expect(response.body.graph).toEqual(graph);
            expect(response.body.createdAt).toBe('2026-01-01T00:00:00.000Z');
        });

        it('ignores an owner sent in the body', async () => {
            await request(testApp.app).put('/api/graphs/sneaky').send(body({ ownerId: testApp.otherId }));
            expect(await testApp.graphs.list(testApp.otherId)).toHaveLength(0);
            expect(await testApp.graphs.list(testApp.myId)).toHaveLength(1);
        });

        it('answers 409 if I already have a graph with that id', async () => {
            await request(testApp.app).put('/api/graphs/g1').send(body({ name: 'First' }));
            const response = await request(testApp.app).put('/api/graphs/g1').send(body({ name: 'Second' }));

            expect(response.status).toBe(409);
            expect(response.body.current.name).toBe('First');
        });

        it('does not clash with another user\'s graph that has the same id', async () => {
            await testApp.graphs.save(
                testApp.otherId,
                { id: 'shared-id', name: 'Theirs', graph, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                0,
            );

            const response = await request(testApp.app).put('/api/graphs/shared-id').send(body({ name: 'Mine' }));

            expect(response.status).toBe(201);
            expect((await testApp.graphs.get(testApp.otherId, 'shared-id'))?.name).toBe('Theirs');
        });
    });

    describe('PUT /api/graphs/:id validation', () => {
        it('rejects a graph with an edge to a missing node, and says where', async () => {
            const broken = { ...graph, edges: [{ id: 'e1', source: 'a', destination: 'ghost' }] };
            const response = await request(testApp.app).put('/api/graphs/g1').send(body({ graph: broken }));

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('The graph is not valid.');
            expect(response.body.details.join(' ')).toContain('graph.edges[0].destination');
        });

        it('rejects a missing name', async () => {
            const response = await request(testApp.app).put('/api/graphs/g1').send(body({ name: undefined }));
            expect(response.status).toBe(400);
        });

        it('rejects a missing or negative revision', async () => {
            const missing = await request(testApp.app).put('/api/graphs/g1').send(body({ revision: undefined }));
            const negative = await request(testApp.app).put('/api/graphs/g1').send(body({ revision: -1 }));
            expect(missing.status).toBe(400);
            expect(negative.status).toBe(400);
        });

        it('rejects a body with no JSON at all', async () => {
            const response = await request(testApp.app).put('/api/graphs/g1');
            expect(response.status).toBe(400);
        });

        it('rejects text that is not valid JSON', async () => {
            const response = await request(testApp.app)
                .put('/api/graphs/g1')
                .set('Content-Type', 'application/json')
                .send('{ this is not json');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'The request body is not valid JSON.' });
        });

        it('rejects a body larger than the size limit', async () => {
            const response = await request(testApp.app)
                .put('/api/graphs/g1')
                .send(body({ padding: 'x'.repeat(LIMITS.maxFileBytes) }));

            expect(response.status).toBe(413);
        });
    });

    describe('PUT /api/graphs/:id with revision 1 or more (replacing a graph)', () => {
        it('saves a new version and raises the revision', async () => {
            await request(testApp.app).put('/api/graphs/g1').send(body({ name: 'Old' }));
            const response = await request(testApp.app)
                .put('/api/graphs/g1')
                .send(body({ name: 'New', revision: 1, updatedAt: '2026-02-02T00:00:00.000Z' }));

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New');
            expect(response.body.revision).toBe(2);
        });

        it('answers 409 with the current version when the revision is stale', async () => {
            await request(testApp.app).put('/api/graphs/g1').send(body());
            await request(testApp.app).put('/api/graphs/g1').send(body({ name: 'Tab one', revision: 1 }));

            const response = await request(testApp.app).put('/api/graphs/g1').send(body({ name: 'Tab two', revision: 1 }));

            expect(response.status).toBe(409);
            expect(response.body.current.name).toBe('Tab one');
            expect(response.body.current.revision).toBe(2);
        });

        it('answers 404 for an id that does not exist', async () => {
            const response = await request(testApp.app).put('/api/graphs/unknown').send(body({ revision: 2 }));
            expect(response.status).toBe(404);
        });

        it('cannot overwrite someone else\'s graph', async () => {
            await testApp.graphs.save(
                testApp.otherId,
                { id: 'theirs', name: 'Theirs', graph, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                0,
            );

            const response = await request(testApp.app).put('/api/graphs/theirs').send(body({ name: 'Hijacked', revision: 1 }));

            expect(response.status).toBe(404);
            expect((await testApp.graphs.get(testApp.otherId, 'theirs'))?.name).toBe('Theirs');
        });
    });

    describe('GET /api/graphs', () => {
        it('lists only my graphs, with their content', async () => {
            await request(testApp.app).put('/api/graphs/mine').send(body({ name: 'Mine' }));
            await testApp.graphs.save(
                testApp.otherId,
                { id: 'theirs', name: 'Theirs', graph, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                0,
            );

            const response = await request(testApp.app).get('/api/graphs');

            expect(response.status).toBe(200);
            expect(response.body.map((g: { name: string }) => g.name)).toEqual(['Mine']);
            expect(response.body[0].graph).toEqual(graph);
            expect(response.body[0].revision).toBe(1);
        });
    });

    describe('GET /api/graphs/:id', () => {
        it('returns the graph', async () => {
            await request(testApp.app).put('/api/graphs/g1').send(body());
            const response = await request(testApp.app).get('/api/graphs/g1');

            expect(response.status).toBe(200);
            expect(response.body.graph).toEqual(graph);
        });

        it('answers 404 for an unknown id', async () => {
            expect((await request(testApp.app).get('/api/graphs/unknown')).status).toBe(404);
        });

        it('answers 404, not 403, for someone else\'s graph', async () => {
            await testApp.graphs.save(
                testApp.otherId,
                { id: 'theirs', name: 'Theirs', graph, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                0,
            );
            expect((await request(testApp.app).get('/api/graphs/theirs')).status).toBe(404);
        });
    });

    describe('DELETE /api/graphs/:id', () => {
        it('deletes the graph and answers 204', async () => {
            await request(testApp.app).put('/api/graphs/g1').send(body());
            expect((await request(testApp.app).delete('/api/graphs/g1')).status).toBe(204);
            expect((await request(testApp.app).get('/api/graphs/g1')).status).toBe(404);
        });

        it('answers 404 for an unknown id', async () => {
            expect((await request(testApp.app).delete('/api/graphs/unknown')).status).toBe(404);
        });

        it('cannot delete someone else\'s graph', async () => {
            await testApp.graphs.save(
                testApp.otherId,
                { id: 'theirs', name: 'Theirs', graph, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
                0,
            );

            expect((await request(testApp.app).delete('/api/graphs/theirs')).status).toBe(404);
            expect(await testApp.graphs.get(testApp.otherId, 'theirs')).not.toBeNull();
        });
    });
});