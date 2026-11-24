import { createHash, randomBytes } from "crypto";
import type { Db } from "../db/connection";
import { sessions } from "../db/schema";
import { eq, lte } from "drizzle-orm";

export type NewSession = { token: string; expiresAt: Date };

export interface SessionStore {
    // Starts a session. The returned token goes into the cookie and is not stored anywhere else.
    create(userId: string): Promise<NewSession>;

    // The user this token belongs to, or null if it is unknown or expired.
    findUserId(token: string): Promise<string | null>;

    // Ends one session (log out).
    delete(token: string): Promise<void>;

    // Remove expired sessions from the table. Returns how many.
    deleteExpired(): Promise<number>;
}

type Options = {
    lifetimeMs: number;
    // The clock is a parameter so tests can jump forward in time.
    now?: () => Date;
}


// The database keeps only this fingerprint. SHA-256 is fine here (unlike for passwords) because the token
// is 256 random bits: there is nothing to guess, so there is no need for a slow hash.
function fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function createSessionStore(db: Db, { lifetimeMs, now = () => new Date() }: Options): SessionStore {
    return {
        async create(userId) {
            // 32 bytes from the operating system's secure random generator. Never use Math.random for this.
            const token = randomBytes(32).toString('base64url');
            const created = now();
            const expiresAt = new Date(created.getTime() + lifetimeMs);

            db.insert(sessions)
                .values({
                    tokenHash: fingerprint(token), 
                    userId, 
                    createdAt: created.toISOString(), 
                    expiresAt: expiresAt.toISOString(), 
                })
                .run();
            
            return { token, expiresAt };
        }, 

        async findUserId(token) {
            const tokenHash = fingerprint(token);
            const row = db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).get();
            if (!row) return null;

            if (row.expiresAt <= now().toISOString()) {
                db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
                return null;
            }
            return row.userId;
        }, 
        
        async delete(token) {
            db.delete(sessions).where(eq(sessions.tokenHash, fingerprint(token))).run();
        }, 

        async deleteExpired() {
            const removed = db
                .delete(sessions)
                .where(lte(sessions.expiresAt, now().toISOString()))
                .returning({ tokenHash: sessions.tokenHash })
                .all()
            return removed.length;
        }, 
    };
}