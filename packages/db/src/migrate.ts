import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured before migrations");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const migration = await readFile(fileURLToPath(new URL("../migrations/0001_initial.sql", import.meta.url)), "utf8");
  await sql.unsafe(migration);
  console.log("Lookout schema migration 0001 complete");
} finally {
  await sql.end();
}
