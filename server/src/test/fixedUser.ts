import type { RequestHandler } from 'express';

// A stand-in for login, for tests of the graph routes: every request counts as coming from this one user.
export function fixedUser(userId: string): RequestHandler {
    return (_req, res, next) => {
        res.locals.userId = userId;
        next();
    };
}