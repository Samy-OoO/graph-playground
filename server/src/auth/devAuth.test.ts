import { describe, expect, it } from 'vitest';
import { createDb } from '../db/connection';
import { users } from '../db/schema';
import { ensureDevUser } from './devAuth';

describe('ensureDevUser', () => {
    it('creates the placeholder user once and reuses it afterwards', () => {
        const { db, close } = createDb(':memory:');

        const first = ensureDevUser(db);
        const second = ensureDevUser(db);

        expect(second).toBe(first);
        expect(db.select().from(users).all()).toHaveLength(1);
        close();
    });
});