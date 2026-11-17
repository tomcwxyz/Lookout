-- Append-only cross-agent handover history. Each project receives a serial revision.
-- Human-confirmed status and existing v1 contributions are deliberately untouched.
CREATE TABLE IF NOT EXISTS lookout_handover_sessions (
  id bigserial PRIMARY KEY,
  portfolio_project_id integer NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('agent','chatgpt')),
  actor text NOT NULL,
  workstream text NOT NULL,
  revision integer NOT NULL,
  based_on_revision integer,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  reconciliation jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_project_id,event_id),
  UNIQUE (portfolio_project_id,revision)
);
CREATE INDEX IF NOT EXISTS lookout_handover_sessions_recent_idx ON lookout_handover_sessions(portfolio_project_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS lookout_handover_sessions_workstream_idx ON lookout_handover_sessions(portfolio_project_id,workstream,revision DESC);
