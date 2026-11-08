// Settings that can change between the PC and a real server.
export const config = {
  port: Number(process.env.PORT ?? 3001),
  // A file on disk. Tests use ':memory:' instead and never read this.
  dbPath: process.env.DATABASE_PATH ?? 'data/graph-playground.db', 
};