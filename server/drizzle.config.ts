import { defineConfig } from 'drizzle-kit';

// Only used by the drizzle-kit command line tool, never by the running server.
export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/schema.ts',
    out: './drizzle',
});