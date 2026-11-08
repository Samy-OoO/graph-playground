import { createApp } from './app';
import { config } from './config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDb } from './db/connection';

// SQLite creates the DB file for us, but not the folder it sits in.
mkdirSync(dirname(config.dbPath), { recursive: true });
const { db } = createDb(config.dbPath);
console.log(`Database ready at ${config.dbPath}`);

// the app does not use db yet. The next step hands it to the repository.
void db;

createApp().listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});