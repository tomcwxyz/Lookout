-- Limit online guessing of the former admin password during one-time migration.
-- This global window is intentionally independent of self-created account identities.
CREATE TABLE IF NOT EXISTS lookout_legacy_recovery_throttle (
  id smallint PRIMARY KEY CHECK (id = 1),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0
);
