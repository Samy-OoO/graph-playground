import { z } from 'zod';

export const AUTH_LIMITS = {
    maxEmailLength: 254, 
    minPasswordLength: 8, 
    // Hashing a password takes real time and memory, so an absurdly long one must not be accepted.
    maxPasswordLength: 128, 
} as const;

// Trimmed and lower-cased first, then checked, so "  Ann@Example.COM " and "ann@example.com" are the same account.
const emailSchema = z
    .string()
    .trim()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.').max(AUTH_LIMITS.maxEmailLength, 'Email address is too long.'));

export const registerSchema = z.object({
    email: emailSchema, 
    password: z
        .string()
        .min(AUTH_LIMITS.minPasswordLength, `Use at least ${AUTH_LIMITS.minPasswordLength} characters.`)
        .max(AUTH_LIMITS.maxPasswordLength, `Use at most ${AUTH_LIMITS.maxPasswordLength} characters.`),         
});

// Logging in only checks the shape. The password rules apply when it is chosen, not when it is typed again.
export const loginSchema = z.object({
    email: emailSchema, 
    password: z.string().min(1, 'Enter your password.').max(AUTH_LIMITS.maxPasswordLength), 
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// What the server tells the client about a signed-in user. Never includes the password hash.
export const publicUserSchema = z.object({
    id: z.string().min(1),
    email: z.string(), 
});

export type PublicUser = z.infer<typeof publicUserSchema>;