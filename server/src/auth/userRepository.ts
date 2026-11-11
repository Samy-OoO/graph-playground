import { eq } from 'drizzle-orm';
import type { Db } from '../db/connection';
import { users, type UserRow } from '../db/schema';

export type CreateUserResult = { ok: true; user: UserRow } | { ok: false; reason: 'email_taken' };

export interface UserRepository {
    findByEmail(email: string): Promise<UserRow | null>;
    findById(id: string): Promise<UserRow | null>;
    // The email must already be normalized (trimmed, lower case). Emails are unique.
    create(email: string, passwordHash: string): Promise<CreateUserResult>;
}

export function createUserRepository(db: Db): UserRepository {
    return {
        async findByEmail(email) {
            return db.select().from(users).where(eq(users.email, email)).get() ?? null;
        },

        async findById(id) {
            return db.select().from(users).where(eq(users.id, id)).get() ?? null;
        },

        async create(email, passwordHash) {
            // The database enforces "one account per email", so two sign-ups at the same instant cannot both win.
            const [created] = db.insert(users).values({ email, passwordHash }).onConflictDoNothing().returning().all();
            return created ? { ok: true, user: created } : { ok: false, reason: 'email_taken' };
        },
    };
}