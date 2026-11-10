import { z } from 'zod';
import { assertValidDocument, parseDocumentData } from '@graph-playground/shared';
import type { GraphDocument } from '@graph-playground/shared';
import { ConflictError } from './conflictError';
import type { GraphRepository, GraphSummary } from './repository';
import { toSummary } from './repository';

// The server adds a revision to every graph it sends. Our document type does not have one, so read it separately.
const revisionProbe = z.object({ revision: z.number().int().positive() });

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Reads the server's { error } message out of a failed response, if there is one.
async function describeFailure(response: Response): Promise<string> {
    try {
        const body = await response.json();
        if (typeof body?.error === 'string') return body.error;
    } catch {
        // The body was not JSON. The status code is all we have.
    }
    return `The server answered with an error (${response.status}).`;
}

// Stores graphs on the server, through the /api/graphs routes.
export class ApiRepository implements GraphRepository {
    private readonly baseUrl: string;
    private readonly fetchFn: typeof fetch;

    // The revision of each graph, as last seen from the server. Every save has to say which revision it started from.
    private readonly revisions = new Map<string, number>();

    // Tests pass a fake fetch. The default wraps the real one in an arrow function:
    // a browser's fetch throws "Illegal invocation" if it is called as a method of some other object.
    constructor(baseUrl = '/api', fetchFn: typeof fetch = (input, init) => fetch(input, init)) {
        this.baseUrl = baseUrl;
        this.fetchFn = fetchFn;
    }

    private async request(path: string, init?: RequestInit): Promise<Response> {
        try {
            return await this.fetchFn(`${this.baseUrl}${path}`, init);
        } catch (error) {
            // fetch only throws when no answer came back at all: offline, server down, and so on.
            throw new Error('Could not reach the server. Check your connection and try again.', { cause: error });
        }
    }

    // Turns what the server sent into a document, and remembers its revision for the next save.
    private async readGraph(data: unknown): Promise<GraphDocument> {
        const parsed = parseDocumentData(data);
        if (!parsed.ok) {
            throw new Error(`The server sent a graph that could not be read: ${parsed.errors.join('; ')}`);
        }
        const revision = revisionProbe.safeParse(data);
        if (!revision.success) {
            throw new Error('The server sent a graph without a valid revision.');
        }
        this.revisions.set(parsed.document.id, revision.data.revision);
        return parsed.document;
    }

    async list(): Promise<GraphSummary[]> {
        const response = await this.request('/graphs');
        if (!response.ok) throw new Error(await describeFailure(response));

        const items: unknown[] = await response.json();
        const summaries: GraphSummary[] = [];
        for (const item of items) {
            try {
                summaries.push(toSummary(await this.readGraph(item)));
            } catch (error) {
                console.warn('Skipping a graph from the server that could not be read.', error);
            }
        }
        return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    async get(id: string): Promise<GraphDocument | null> {
        const response = await this.request(`/graphs/${encodeURIComponent(id)}`);
        if (response.status === 404) {
            this.revisions.delete(id);
            return null;
        }
        if (!response.ok) throw new Error(await describeFailure(response));
        return this.readGraph(await response.json());
    }

    async save(document: GraphDocument): Promise<void> {
        assertValidDocument(document);

        // A graph this repository has never seen from the server counts as new: revision 0.
        const revision = this.revisions.get(document.id) ?? 0;
        const response = await this.request(`/graphs/${encodeURIComponent(document.id)}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({
                name: document.name,
                graph: document.graph,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt,
                revision,
            }),
        });

        if (response.status === 409) {
            // Deliberately do not adopt the server's revision here. Saving again would then silently
            // overwrite the other change. The caller has to choose: load theirs, or get() and save mine.
            const body = await response.json();
            const current = parseDocumentData(body?.current);
            if (!current.ok) throw new Error(await describeFailure(response));
            throw new ConflictError(current.document);
        }
        if (response.status === 404) {
            // It was deleted somewhere else. Forget the revision, so that saving once more creates it again.
            this.revisions.delete(document.id);
            throw new Error('This graph was deleted somewhere else. Saving again will create it again.');
        }
        if (!response.ok) throw new Error(await describeFailure(response));

        const saved = revisionProbe.safeParse(await response.json());
        if (!saved.success) throw new Error('The server saved the graph but sent back an unreadable answer.');
        this.revisions.set(document.id, saved.data.revision);
    }

    async delete(id: string): Promise<void> {
        const response = await this.request(`/graphs/${encodeURIComponent(id)}`, { method: 'DELETE' });
        // 404 is fine: the contract says deleting something that does not exist does nothing.
        if (!response.ok && response.status !== 404) throw new Error(await describeFailure(response));
        this.revisions.delete(id);
    }
}