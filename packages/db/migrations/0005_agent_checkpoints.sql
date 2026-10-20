-- All checkpoints remain agent-reported proposals; never mark work accepted.
CREATE TABLE IF NOT EXISTS agent_access_tokens (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_access_token_project_idx ON agent_access_tokens(project_id);
CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id bigserial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_id integer NOT NULL REFERENCES agent_access_tokens(id),
  event_id text NOT NULL,
  agent text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status = 'proposed'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, event_id)
);
CREATE INDEX IF NOT EXISTS agent_checkpoint_project_time_idx ON agent_checkpoints(project_id, recorded_at DESC);
