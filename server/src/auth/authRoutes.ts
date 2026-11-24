import { Router, type CookieOptions, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { describeIssues, loginSchema, registerSchema } from '@graph-playground/shared';
import type { AuthService } from './authService';
import { SESSION_COOKIE } from './requireUser';
import type { NewSession } from './sessionStore';

export type AuthRouterOptions = {
    auth: AuthService;
    
    // Protects /me. Passed in, so it is the same middleware that protects the graph routes.
    authenticate: RequestHandler;

    // True in production, where the size is served over HTTPS.
    secureCookies: boolean;

    // How many failed attempts one IP address gets per time window.
    rateLimit: { windowMs: number; limit: number };
};

// All routes are mounted under /api/auth.
export function createAuthRouter({ auth, authenticate, secureCookies, rateLimit: limits }: AuthRouterOptions): Router {
    const router = Router();

    /* 
        httpOnly: JS on the page can't read the cookie, so a script injected into the site cannot steal it.
        sameSite 'lax': the browser does not attach the cookie to requests that other websites trigger
        (cross-site POST, PUT, AND DELETE), which is what other sites from acting as you (CSRF).
        secure: the browser only sends it over HTTPS.
    */
    const cookieOptions: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };

    function startSession(res: Response, session: NewSession) {
        res.cookie(SESSION_COOKIE, session.token, { ...cookieOptions, expires: session.expiresAt });
    }

    const tooMany = { error: 'Too many attempts. Please wait a while and try again.' };

    // Signing up counts every attempt. Logging in counts only the failures, so a real user is never locked out by logging in often.
    const registerLimiter = rateLimit({ ...limits, standardHeaders: 'draft-7', legacyHeaders: false, message: tooMany });
    const loginLimiter = rateLimit({
        ...limits, 
        standardHeaders: 'draft-7', 
        legacyHeaders: false, 
        message: tooMany, 
        skipSuccessfulRequests: true,
    });

    router.post('/register', registerLimiter, async (req, res) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Check your details.', details: describeIssues(parsed.error.issues) });
            return;
        }
        const result = await auth.register(parsed.data);
        if (!result.ok) {
            res.status(409).json({ error: 'An account with this email already exists.' });
            return;
        }

        startSession(res, result.session);
        res.status(201).json(result.user);
    });

    router.post('/login', loginLimiter, async (req, res) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Check your details.', details: describeIssues(parsed.error.issues) });
            return;
        }

        const result = await auth.login(parsed.data);
        if (!result.ok) {
            res.status(401).json({ error: 'Email or password is incorrect.' });
            return;
        }

        startSession(res, result.session);
        res.json(result.user);
    });

    router.post('/logout', async (req, res) => {
        const token: unknown = req.cookies?.[SESSION_COOKIE];
        if (typeof token === 'string' && token !== '') await auth.logout(token);

        res.clearCookie(SESSION_COOKIE, cookieOptions);
        res.status(204).end();
    });

    router.get('/me', authenticate, async (_req, res) => {
        const user = await auth.getUser(res.locals.userId as string);
        if (!user) {
            res.status(401).json({ error: 'You need to sign in.' });
            return;
        }
        res.json(user);
    });
    
    return router;
}