import { fixedUser } from '../auth/devAuth';
import { createApp } from '../app';
import { createDb } from '../db/connection';
import { users } from '../db/schema';
import { createGraphRepository } from '../graphs/sqliteGraphRepository';

// A complete app on a throwaway in-memory database, plus two users: the one making requests, and someone else.
export function createTestApp() {
    const database = createDb(':memory:');
    const [me, other] = database.db
        .insert(users)
        .values([
            { email: 'me@example.com', passwordHash: 'x' }, 
            { email: 'other@example.com', passwordHash: 'x' },
        ])
        .returning()
        .all();
    
    const graphs = createGraphRepository(database.db);
    const app = createApp({ graphs, authenticate: fixedUser(me.id) });

    return { app, graphs, myId: me.id, otherId: other.id, close: database.close };
}