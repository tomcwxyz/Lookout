import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let client: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  client ??= postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20 });
  return drizzle(client, { schema });
}

export async function closeDatabase() {
  if (client) { await client.end(); client = undefined; }
}
