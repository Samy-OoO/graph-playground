import express from 'express';
import { LIMITS } from '@graph-playground/shared';

// Builds the Express app but does not start listening, so tests can use it without a port.
export function createApp() {
    const app = express();

    // Reads JSON request bodies. The size limit comes from the same LIMITS the client uses.
    app.use(express.json({ limit: LIMITS.maxFileBytes }));

    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    return app;
}