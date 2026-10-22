-- Logical projects are separate from GitHub repository observations.
-- All additions are non-destructive; existing repository IDs and links remain stable.
CREATE TABLE IF NOT EXISTS portfolio_projects (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  status text CHECK (status IN ('exploring','building','testing','live','maintaining','paused','archived')),
  status_note text,
  status_confirmed_at timestamptz,
  legacy_project_id integer UNIQUE REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS repository_inventory (
  provider_id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'unknown',
  archived boolean NOT NULL DEFAULT false,
  fork boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  detailed_at timestamptz,
  inspection_error text
);
CREATE UNIQUE INDEX IF NOT EXISTS repository_inventory_slug_uq ON repository_inventory(lower(slug));
CREATE TABLE IF NOT EXISTS portfolio_repository_links (
  repository_provider_id text PRIMARY KEY REFERENCES repository_inventory(provider_id) ON DELETE CASCADE,
  portfolio_project_id integer NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfolio_repo_project_idx ON portfolio_repository_links(portfolio_project_id);
CREATE TABLE IF NOT EXISTS github_scan_state (
  id integer PRIMARY KEY CHECK (id = 1),
  next_offset integer NOT NULL DEFAULT 0,
  inventory_count integer NOT NULL DEFAULT 0,
  last_inventory_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO github_scan_state (id) VALUES (1) ON CONFLICT DO NOTHING;
-- Preserve existing 25 observed repositories, human decisions and agent tokens.
INSERT INTO repository_inventory (provider_id, slug, name, url, description, last_activity_at, detailed_at, last_seen_at)
SELECT provider_id, slug, name, url, description,
  CASE WHEN snapshot->>'lastActivityAt' ~ '^\\d{4}-\\d{2}-\\d{2}T' THEN (snapshot->>'lastActivityAt')::timestamptz ELSE NULL END,
  observed_at, observed_at
FROM projects WHERE true ON CONFLICT (provider_id) DO NOTHING;
INSERT INTO portfolio_projects (name, description, legacy_project_id)
SELECT name, description, id FROM projects WHERE true
ON CONFLICT (legacy_project_id) DO NOTHING;
INSERT INTO portfolio_repository_links (repository_provider_id, portfolio_project_id)
SELECT p.provider_id, pp.id FROM projects p
JOIN portfolio_projects pp ON pp.legacy_project_id = p.id WHERE true
ON CONFLICT (repository_provider_id) DO NOTHING;
