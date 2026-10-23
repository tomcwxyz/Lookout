-- Agent contributions are attributed self-reports, never human decisions or verified CI evidence.
-- Existing repository checkpoints and project-scoped tokens remain valid.
CREATE TABLE IF NOT EXISTS agent_contributions (
  id bigserial PRIMARY KEY,
  portfolio_project_id integer NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  observed_project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_id integer NOT NULL REFERENCES agent_access_tokens(id),
  event_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('progress','evidence','blocker','handover','next_action')),
  agent text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status = 'proposed'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_project_id, event_id)
);
CREATE INDEX IF NOT EXISTS agent_contributions_project_time_idx ON agent_contributions(portfolio_project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS agent_contributions_observed_idx ON agent_contributions(observed_project_id, recorded_at DESC);
