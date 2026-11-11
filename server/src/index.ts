import { createApp } from './app';
import { config } from './config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDb } from './db/connection';
import { createGraphRepository } from './graphs/sqliteGraphRepository';
import { ensureDevUser, fixedUser } from './auth/devAuth';

// SQLite creates the DB file for us, but not the folder it sits in.
mkdirSync(dirname(config.dbPath), { recursive: true });
const { db } = createDb(config.dbPath);
console.log(`Database ready at ${config.dbPath}`);

// This is the wiring: build each piece and hand it to the next one.
// Until real login exists, every req is stated as coming from one placeholder user.
const graphs = createGraphRepository(db);
const authenticate = fixedUser(ensureDevUser(db));

createApp({ graphs, authenticate }).listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});

/*
1.	Prepare the filesystem
2.	Establish the database connection
3.	Create the graph repository
4.	Configure authentication
5.	Inject dependencies and start the server
*/