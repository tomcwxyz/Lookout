import { randomUUID } from "node:crypto";
import postgres from "postgres";

export class ObservationAlreadyRunningError extends Error {
  constructor(public readonly provider: string) {
    super("An observation is already running for " + provider);
    this.name = "ObservationAlreadyRunningError";
  }
}

/** Atomic per-provider database lease shared by manual and scheduled scans. */
export async function withObservationLease<T>(provider: "github" | "neon" | "vercel", work: () => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const client = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 20 });
  const token = randomUUID();
  let acquired = false;
  try {
    const rows = await client.unsafe<{ provider: string }[]>(
      "INSERT INTO observation_locks (provider, owner_token, acquired_at, expires_at) " +
      "VALUES ($1, $2::uuid, now(), now() + interval '10 minutes') " +
      "ON CONFLICT (provider) DO UPDATE SET owner_token = EXCLUDED.owner_token, " +
      "acquired_at = now(), expires_at = EXCLUDED.expires_at " +
      "WHERE observation_locks.expires_at <= now() RETURNING provider", [provider, token]);
    if (rows.length === 0) throw new ObservationAlreadyRunningError(provider);
    acquired = true;
    return await work();
  } finally {
    try {
      if (acquired) {
        await client.unsafe("DELETE FROM observation_locks WHERE provider = $1 AND owner_token = $2::uuid", [provider, token]);
      }
    } finally {
      await client.end();
    }
  }
}
