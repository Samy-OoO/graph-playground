import type { LoginInput, PublicUser, RegisterInput } from "@graph-playground/shared";
import type { NewSession, SessionStore } from "./sessionStore";
import type { UserRepository } from "./userRepository";
import type { PasswordHasher } from "./passwordHasher";
import type { UserRow } from "../db/schema";

export type RegisterResult = 
    | { ok: true; user: PublicUser; session: NewSession }
    | { ok: false; reason: 'email_taken' };

export type LoginResult = 
    | { ok: true; user: PublicUser; session: NewSession }
    | { ok: false; reason: 'invalid_credentials' };


// The rules of accounts and sessions, with no HTTP in sight. The routes only translate these results.
export interface AuthService {
    register(input: RegisterInput): Promise<RegisterResult>;
    login(input: LoginInput): Promise<LoginResult>;
    logout(token: string): Promise<void>;

    // Who is behind this cookie token? Null if nobody (unknown, expired, logged out).
    userIdForToken(token: string): Promise<string | null>;
    getUser(id: string): Promise<PublicUser | null>;
}

type Dependencies = {
    users: UserRepository;
    sessions: SessionStore;
    hasher: PasswordHasher;
};

// Only these fields ever leave the server. The password hash is not among them.
function toPublicUser(row: UserRow): PublicUser {
    return { id: row.id, email: row.email };
}

export function createAuthService({ users, sessions, hasher }: Dependencies): AuthService {
    // A real hash of a password nobody has. Used to keep "no such email" as slow as "wrong password" (see login).
    let dummyHash: Promise<string> | null = null;
    const getDummyHash = () => (dummyHash ??= hasher.hash('this is not anybody\'s password.'));
    return {
        async register({ email, password }) {
            const created = await users.create(email, await hasher.hash(password));
            if (!created.ok) return { ok: false, reason: 'email_taken' };

            // Signing up also signs you in.
            const session = await sessions.create(created.user.id);
            return { ok: true, user: toPublicUser(created.user), session };
        }, 

        async login({ email, password }) {
            const user = await users.findByEmail(email);

            // Always do the slow password check, even when the email is unknown. Otherwise an answer that comes back instantly would tell an attacker "this email has no account", just by timing it.
            const matches = await hasher.verify(user?.passwordHash ?? (await getDummyHash()), password);

            // One answer for both failures, so the response does not reveal which emails have accounts.
            if (!user || !matches) return { ok: false, reason: 'invalid_credentials' };

            const session = await sessions.create(user.id);
            return { ok: true, user: toPublicUser(user), session };
        },

        async logout(token) {
            await sessions.delete(token);
        }, 

        userIdForToken: (token) => sessions.findUserId(token), 

        async getUser(id) {
            const row = await users.findById(id);
            return row ? toPublicUser(row) : null;
        },
    };
}