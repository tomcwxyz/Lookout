CREATE TABLE IF NOT EXISTS infrastructure_resources (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  provider text NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  parent_key text,
  project_id integer REFERENCES projects(id) ON DELETE SET NULL,
  link_method text,
  snapshot jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS infra_provider_idx ON infrastructure_resources(provider);
CREATE INDEX IF NOT EXISTS infra_project_idx ON infrastructure_resources(project_id);
CREATE TABLE IF NOT EXISTS infrastructure_findings (
  id serial PRIMARY KEY,
  resource_id integer NOT NULL REFERENCES infrastructure_resources(id) ON DELETE CASCADE,
  key text NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  explanation text NOT NULL,
  evidence_url text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  observed_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS infra_finding_resource_key_uq ON infrastructure_findings(resource_id, key);
CREATE INDEX IF NOT EXISTS infra_finding_status_idx ON infrastructure_findings(status);
CREATE TABLE IF NOT EXISTS source_sync_runs (
  id serial PRIMARY KEY,
  provider text NOT NULL,
  status text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS source_sync_provider_idx ON source_sync_runs(provider, started_at DESC);
