import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

export const hasDatabase = Boolean(databaseUrl);

export function getSql() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured. Add the Neon connection string to the server environment.");
  }
  return neon(databaseUrl);
}
