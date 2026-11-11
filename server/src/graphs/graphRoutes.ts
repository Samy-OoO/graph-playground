import { describeIssues, saveGraphSchema } from '@graph-playground/shared';
import { Router, type Response } from 'express';
import type { GraphRepository } from './graphRepository';

// The authentication middleware stores the user's id in res.locals. Routes read it from here and nowhere else,
// so a client can never choose whose graphs it sees by sending an id of its own.
function currentUserId(res: Response): string {
    return res.locals.userId as string;
}

function sendNotFound(res: Response) {
    res.status(404).json({ error: 'Graph not found.' });
}

// All routes are mounted under /api/graphs, so '/' below means /api/graphs.
export function createGraphRouter(graphs: GraphRepository): Router {
    const router = Router();

    router.get('/', async (_req, res) => {
        res.json(await graphs.list(currentUserId(res)));
    });

    router.get('/:id', async (req, res) => {
        const found = await graphs.get(currentUserId(res), req.params.id);
        if (!found) return sendNotFound(res);
        res.json(found);
    });

    router.put('/:id', async (req, res) => {
        const parsed = saveGraphSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'The graph is not valid.', details: describeIssues(parsed.error.issues) });
            return;
        }

        const { revision, ...rest } = parsed.data;
        const result = await graphs.save(currentUserId(res), { id: req.params.id, ...rest }, revision);

        if (result.ok) return res.status(revision === 0 ? 201 : 200).json(result.graph)
        if (result.reason ===  'not_found') return sendNotFound(res);

        // 409 Conflict: the graph changes since the client last saw it. Send the current version do the UI can offer a choice.
        res.status(409).json({ 
            error: 'This graph was changed somewhere else since you opened it.',
            current: result.current,
        });
    });

    router.delete('/:id', async(req, res) => {
        const removed = await graphs.delete(currentUserId(res), req.params.id);
        if (!removed) return sendNotFound(res);
        res.status(204).end();
    });

    return router;
}