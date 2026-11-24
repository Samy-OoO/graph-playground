// A stand-in for the real server, for tests. It follows the same rules as server/src/graphs:
// a new graph is revision 0, a replace must match the stored revision, and a mismatch is a 409.
type StoredGraph = {
    id: string;
    name: string;
    graph: unknown;
    schemaVersion: number;
    revision: number;
    createdAt: string;
    updatedAt: string;
};

export type RecordedRequest = { method: string; path: string; body: Record<string, unknown> | null };

function reply(status: number, body?: unknown): Response {
    if (status === 204 || body === undefined) return new Response(null, { status });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function createFakeGraphServer() {
    const stored = new Map<string, StoredGraph>();
    const requests: RecordedRequest[] = [];
    let offline = false;
    let nextAnswer: Response | null = null;

    const fetchFn: typeof fetch = async (input, init) => {
        if (offline) throw new TypeError('Failed to fetch');

        const path = new URL(String(input), 'http://fake.test').pathname;
        const method = init?.method ?? 'GET';
        const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
        requests.push({ method, path, body });

        if (nextAnswer) {
            const answer = nextAnswer;
            nextAnswer = null;
            return answer;
        }

        const id = decodeURIComponent(path.replace('/api/graphs', '').replace(/^\//, ''));

        if (id === '') return reply(200, [...stored.values()]);

        if (method === 'GET') {
            const found = stored.get(id);
            return found ? reply(200, found) : reply(404, { error: 'Graph not found.' });
        }

        if (method === 'DELETE') {
            return stored.delete(id) ? reply(204) : reply(404, { error: 'Graph not found.' });
        }

        if (method === 'PUT' && body) {
            const existing = stored.get(id);
            const revision = body.revision as number;

            if (revision === 0) {
                if (existing) return reply(409, { error: 'Changed elsewhere.', current: existing });   
            } else {
                if (!existing) return reply(404, { error: 'Graph not found' });
                if (existing.revision !== revision) return reply(409, { error: 'Changed elsewhere.', current: existing });
            }

            const saved: StoredGraph = {
                id, 
                name: body.name as string, 
                graph: body.graph, 
                schemaVersion: 1, 
                revision: (existing?.revision ?? 0) + 1, 
                createdAt: existing?.createdAt ?? (body.createdAt as string), 
                updatedAt: body.updatedAt as string, 
            };
            stored.set(id, saved);
            return reply(revision === 0 ? 201 : 200, saved);
        }

        return reply(400, { error: 'Unsupported request.' });
    };

    return {
        fetchFn, 
        requests, 
        stored, 
        // The next request gets this answer instead of the normal one.
        answerNextWith(status: number, body?: unknown) {
            nextAnswer = reply(status, body);
        }, 
        goOffline() {
            offline = true;
        },
    };
}