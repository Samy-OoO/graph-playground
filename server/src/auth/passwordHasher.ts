import argon2 from 'argon2';

// Turns a password into something safe to store, and checks a typed password against it.
// An interface, so tests can use a fast fake instead of waiting for real hashing on every test.
export interface PasswordHasher {
    hash(plain: string): Promise<string>;
    verify(hash: string, plain: string): Promise<boolean>;
}

// Argon2id with the library's default settings, which are chosen to be slow and memory-hungry on purpose, so that guessing millions of passwords from a stolen database is expensive.
// The result is one text value that holds the algorithm, its settings, a random salt and the hash.
export const argon2Hasher: PasswordHasher = {
    hash: (plain) => argon2.hash(plain), 

    async verify(hash, plain) {
        try {
            return await argon2.verify(hash, plain);
        } catch {
            // A stored value that is not a valid hash at all. Treat it as "wrong password", never as a crash.
            return false;
        }
    },
};