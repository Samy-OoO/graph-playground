// Settings that can change between the PC and a real server.
export const config = {
  port: Number(process.env.PORT ?? 3001),
  // A file on disk. Tests use ':memory:' instead and never read this.
  dbPath: process.env.DATABASE_PATH ?? 'data/graph-playground.db', 
  // In production the site runs over HTTPS, and the session cookie must then never travel over plain HTTP.
  isProduction: process.env.NODE_ENV === 'production', 
  // How long a ligin stays valid.
  sessionLifetimeDays: 30, 
};