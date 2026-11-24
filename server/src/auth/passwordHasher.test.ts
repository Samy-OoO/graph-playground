import { describe, expect, it } from 'vitest';
import { argon2Hasher } from './passwordHasher';

describe('argon2Hasher', () => {
    it('never stores the password itself', async () => {
        const hash = await argon2Hasher.hash('correct horse battery staple');
        expect(hash).not.toContain('correct horse');
        expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('accepts the right password and rejects a wrong one', async () => {
        const hash = await argon2Hasher.hash('correct horse battery staple');
        expect(await argon2Hasher.verify(hash, 'correct horse battery staple')).toBe(true);
        expect(await argon2Hasher.verify(hash, 'Correct horse battery staple')).toBe(false);
        expect(await argon2Hasher.verify(hash, '')).toBe(false);
    });

    it('gives a different result every time for the same password (random salt)', async () => {
        const first = await argon2Hasher.hash('same password');
        const second = await argon2Hasher.hash('same password');
        expect(first).not.toBe(second);
        expect(await argon2Hasher.verify(first, 'same password')).toBe(true);
        expect(await argon2Hasher.verify(second, 'same password')).toBe(true);
    });

    it('treats a stored value that is not a hash as a wrong password instead of crashing', async () => {
        expect(await argon2Hasher.verify('not-a-real-login', 'anything')).toBe(false);
    });
});