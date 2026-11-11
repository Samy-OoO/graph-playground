import type { RequestHandler } from "express";
import type { AuthService } from "./authService";

export const SESSION_COOKIE = 'gp_session';

// The real authentication: finds the session behind the cookie, and puts the user's id in res.locals for the routes.
// Anything without a valid session is turned away with 401 before it reaches a route.
export function requireUser(auth: AuthService): RequestHandler {
    return async (req, res, next) => {
        const token: unknown = req.cookies?.[SESSION_COOKIE];
        const userId = typeof token === 'string' && token !== '' ? await auth.userIdForToken(token) : null; 

        if (!userId) {
            res.status(401).json({ error: 'You need to sign in.' });
            return;
        }

        res.locals.userId = userId;
        next();
    };
}