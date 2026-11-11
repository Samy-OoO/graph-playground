import { describe, expect, it } from 'vitest';
import { AUTH_LIMITS, loginSchema, registerSchema } from './authSchema';

describe('registerSchema', () => {
    it('accepts a valid email and password', () => {
        const result = registerSchema.safeParse({ email: 'ann@example.com', password: 'long enough password' });
        expect(result.success).toBe(true);
    });

    it('trims and lower-cases the email, so it is the same account however it is typed', () => {
        const result = registerSchema.parse({ email: '  Ann@Example.COM ', password: 'long enough password' });
        expect(result.email).toBe('ann@example.com');
    });

    it('rejects an email that is not an email', () => {
        for (const email of ['', 'ann', 'ann@', '@example.com', 'ann@example', 'a b@example.com']) {
            expect(registerSchema.safeParse({ email, password: 'long enough password' }).success, email).toBe(false);
        }
    });

    it('rejects a password that is too short or too long', () => {
        const email = 'ann@example.com';
        expect(registerSchema.safeParse({ email, password: 'a'.repeat(AUTH_LIMITS.minPasswordLength - 1) }).success).toBe(false);
        expect(registerSchema.safeParse({ email, password: 'a'.repeat(AUTH_LIMITS.minPasswordLength) }).success).toBe(true);
        expect(registerSchema.safeParse({ email, password: 'a'.repeat(AUTH_LIMITS.maxPasswordLength) }).success).toBe(true);
        expect(registerSchema.safeParse({ email, password: 'a'.repeat(AUTH_LIMITS.maxPasswordLength + 1) }).success).toBe(false);
    });

    it('does not trim the password, because spaces may be part of it', () => {
        const result = registerSchema.parse({ email: 'ann@example.com', password: '  spaces matter  ' });
        expect(result.password).toBe('  spaces matter  ');
    });

    it('rejects missing fields and wrong types', () => {
        expect(registerSchema.safeParse({}).success).toBe(false);
        expect(registerSchema.safeParse({ email: 'ann@example.com' }).success).toBe(false);
        expect(registerSchema.safeParse({ email: 'ann@example.com', password: 12345678 }).success).toBe(false);
    });
});

describe('loginSchema', () => {
    it('normalizes the email the same way', () => {
        expect(loginSchema.parse({ email: ' ANN@example.com', password: 'x' }).email).toBe('ann@example.com');
    });

    it('accepts any non-empty password, because the rules apply when choosing one', () => {
        expect(loginSchema.safeParse({ email: 'ann@example.com', password: 'x' }).success).toBe(true);
        expect(loginSchema.safeParse({ email: 'ann@example.com', password: '' }).success).toBe(false);
    });
});