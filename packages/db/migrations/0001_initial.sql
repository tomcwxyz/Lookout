BEGIN;
CREATE TABLE IF NOT EXISTS projects (
  id serial PRIMARY KEY,
  provider_id text NOT NULL UNIQUE,
  slug text NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  description text,
  snapshot jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  rule_summary text NOT NULL,
  ai_brief text,
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attention_items (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  explanation text NOT NULL,
  evidence_url text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  observed_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS attention_project_key_uq ON attention_items(project_id, key);
CREATE INDEX IF NOT EXISTS attention_status_idx ON attention_items(status, project_id);
CREATE TABLE IF NOT EXISTS sync_runs (
  id serial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  project_count integer NOT NULL DEFAULT 0,
  error text
);
CREATE TABLE IF NOT EXISTS ideas (
  id serial PRIMARY KEY,
  project_id integer REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'inbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
