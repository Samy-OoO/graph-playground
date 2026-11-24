import express, { type RequestHandler } from 'express';
import { LIMITS } from '@graph-playground/shared';
import type { GraphRepository } from './graphs/graphRepository';
import { createGraphRouter } from './graphs/graphRoutes';
import { apiNotFound, errorHandler } from './http/errorHandler';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from './auth/authRoutes';
import type { AuthService } from './auth/authService';

// Everything the app needs from the outside. Passing it in (instead of creating it in here)
// lets tests use an in-memory database and lets real login replace the placeholder later.
export type AppDependencies = {
    graphs: GraphRepository;
    auth: AuthService;
    // Decides who is making the request. It must set res.locals.userId, or answer with an error.
    authenticate: RequestHandler;
    secureCookies: boolean;
    authRateLimit: { windowMs: number; limit: number };
};

// Builds the Express app but does not start listening, so tests can use it without a port.
export function createApp({ graphs, auth, authenticate, secureCookies, authRateLimit }: AppDependencies) {
    const app = express();

    // Reads JSON request bodies. The size limit comes from the same LIMITS the client uses.
    app.use(express.json({ limit: LIMITS.maxFileBytes }));

    // Reads the Cookie header into req.cookies.
    app.use(cookieParser());

    // Public: no login needed.
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    // Register, log in, log out, and "who am I?".
    app.use('/api/auth', createAuthRouter({ auth, authenticate, secureCookies, rateLimit: authRateLimit }));

    // Everything under /api/graphs goes through authenticate first.
    app.use('/api/graphs', authenticate, createGraphRouter(graphs));

    // These two must come last: they catch whatever nothing abve handled.
    app.use('/api', apiNotFound);
    app.use(errorHandler);

    return app;
}