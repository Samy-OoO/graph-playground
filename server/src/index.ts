import { createApp } from './app';
import { config } from './config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDb } from './db/connection';
import { createGraphRepository } from './graphs/sqliteGraphRepository';
import { createSessionStore } from './auth/sessionStore';
import { createAuthService } from './auth/authService';
import { createUserRepository } from './auth/userRepository';
import { argon2Hasher } from './auth/passwordHasher';
import { requireUser } from './auth/requireUser';

const DAY_MS = 24 * 60 * 60 * 1000;

// SQLite creates the DB file for us, but not the folder it sits in.
mkdirSync(dirname(config.dbPath), { recursive: true });
const { db } = createDb(config.dbPath);
console.log(`Database ready at ${config.dbPath}`);

// This is the wiring: build each piece and hand it to the next one.
// Until real login exists, every req is stated as coming from one placeholder user.
const graphs = createGraphRepository(db);
const sessions = createSessionStore(db, { lifetimeMs: config.sessionLifetimeDays * DAY_MS });
const auth = createAuthService({ users: createUserRepository(db), sessions, hasher: argon2Hasher });


// Expired sessions are useless, so sweep them away now and then once an hour.
void sessions.deleteExpired();
setInterval(() => void sessions.deleteExpired(), 60 * 60 * 1000).unref();

createApp({ 
  graphs, 
  auth, 
  authenticate: requireUser(auth), 
  secureCookies: config.isProduction, 
  authRateLimit: { windowMs: 15 * 60 * 1000, limit: 10 }, 
}).listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});

/*
1.	Prepare the filesystem
2.	Establish the database connection
3.	Create the graph repository
4.	Configure authentication
5.	Inject dependencies and start the server
*/