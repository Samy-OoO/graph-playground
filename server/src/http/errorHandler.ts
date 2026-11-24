import type { ErrorRequestHandler, RequestHandler } from 'express';

// Any /api URL that no route matched.
export const apiNotFound: RequestHandler = (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
};

// Express sends errors that nobody handled here. Without it, the client would get an HTML error page instead of JSON.
// Four parameters is how Express recognises an error handler, so keep all four even though _next is unused.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // The JSON body reader attaches a status (400 or 413) and a type to the errors it throws.
    const status = typeof err?.status === 'number' ? err.status : 500;

    if (status === 413) {
        res.status(413).json({ error: 'The request is too large.' });
    } else if (err?.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'The request body is not valid JSON.' });
    } else if (status < 500) {
        res.status(status).json({ error: 'The request could not be processed.' });
    } else {
        // Our own bug: log the details for ourselves, but tell the client nothing about the inside of the server.
        console.error(err);
        res.status(500).json({ error: 'Something went wrong on the server.' });
    }
};