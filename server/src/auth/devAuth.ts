import type { Db } from "../db/connection";
import { eq } from 'drizzle-orm';
import { users } from "../db/schema";
import type { RequestHandler } from "express";

const DEV_EMAIL = 'dev@localhost';

// Finds the placeholder user, or creates it the first time. Returns its id.
// The password hash is not a real hash, so nobody can ever log in as this user.
export function ensureDevUser(db: Db): string {
    const existing = db.select().from(users).where(eq(users.email, DEV_EMAIL)).get();
    if (existing) return existing.id;

    const [created] = db
        .insert(users)
        .values({ email: DEV_EMAIL, passwordHash: 'not-a-real-login' })
        .returning()
        .all()
    return created.id;
}


// A stand-in for real authentication: every request counts as coming from this one user.
// When login exists, a real middleware replaces this one and the routes do not change.
export function fixedUser(userId: string): RequestHandler {
    return (_req, res, next) => {
        res.locals.userId = userId;
        next();
    };
}