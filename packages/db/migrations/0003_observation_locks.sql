-- Separate providers have independent leases; expiry recovers interrupted serverless runs.
CREATE TABLE IF NOT EXISTS observation_locks (
  provider text PRIMARY KEY CHECK (provider IN ('github', 'neon', 'vercel')),
  owner_token uuid NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
