import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/**
 * Lookout-owned schema migrations only. Never run this command against a
 * database being observed through an external connector.
 */
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured before migrations");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const migrations = ["0001_initial.sql", "0002_infrastructure.sql", "0003_observation_locks.sql", "0004_work_decisions.sql", "0005_agent_checkpoints.sql", "0006_oauth_personal.sql", "0007_portfolio_inventory.sql", "0008_agent_contributions.sql"] as const;

try {
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS lookout_schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const filename of migrations) {
    const applied = await sql.unsafe<{ filename: string }[]>(
      "SELECT filename FROM lookout_schema_migrations WHERE filename = $1",
      [filename]
    );
    if (applied.length > 0) {
      console.log("Already applied:", filename);
      continue;
    }
    const text = await readFile(
      fileURLToPath(new URL("../migrations/" + filename, import.meta.url)), "utf8"
    );
    // These bundled migrations contain only straightforward DDL without
    // embedded SQL procedure bodies or literal semicolons.
    const statements = text.replace(/^\s*BEGIN;\s*/i, "")
      .replace(/\s*COMMIT;\s*$/i, "")
      .split(";").map(s => s.trim()).filter(Boolean);

    await sql.begin(async tx => {
      for (const statement of statements) await tx.unsafe(statement);
      await tx.unsafe(
        "INSERT INTO lookout_schema_migrations (filename) VALUES ($1)", [filename]
      );
    });
    console.log("Applied:", filename);
  }
} finally {
  await sql.end();
}
