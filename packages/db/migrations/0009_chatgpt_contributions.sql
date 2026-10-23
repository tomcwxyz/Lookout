-- Owner-authorised ChatGPT reports are separate from repository-token reports.
CREATE TABLE IF NOT EXISTS chatgpt_contributions (
 id bigserial PRIMARY KEY,
 portfolio_project_id integer NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
 client_id text NOT NULL,
 event_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('progress','evidence','blocker','handover','next_action')),
 payload jsonb NOT NULL,
 payload_hash text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (portfolio_project_id, client_id, event_id)
);
CREATE INDEX IF NOT EXISTS chatgpt_contributions_recent_idx ON chatgpt_contributions(portfolio_project_id, recorded_at DESC);
