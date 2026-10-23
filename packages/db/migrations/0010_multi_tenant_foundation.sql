-- Multi-tenant foundation. Additive only: legacy single-owner data remains untouched.
-- No default memberships are created and no legacy data becomes public.
CREATE TABLE IF NOT EXISTS lookout_organisations (
 id bigserial PRIMARY KEY,
 slug text NOT NULL UNIQUE,
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lookout_users (
 id bigserial PRIMARY KEY,
 email text NOT NULL,
 display_name text,
 created_at timestamptz NOT NULL DEFAULT now(),
 disabled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS lookout_users_email_lower_uq ON lookout_users (lower(email));
CREATE TABLE IF NOT EXISTS lookout_auth_identities (
 id bigserial PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES lookout_users(id) ON DELETE CASCADE,
 issuer text NOT NULL,
 subject text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (issuer,subject)
);
CREATE TABLE IF NOT EXISTS lookout_organisation_memberships (
 organisation_id bigint NOT NULL REFERENCES lookout_organisations(id) ON DELETE CASCADE,
 user_id bigint NOT NULL REFERENCES lookout_users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','admin','member','viewer')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organisation_id,user_id)
);
CREATE TABLE IF NOT EXISTS lookout_project_access (
 portfolio_project_id integer NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
 organisation_id bigint NOT NULL REFERENCES lookout_organisations(id) ON DELETE CASCADE,
 PRIMARY KEY(portfolio_project_id,organisation_id)
);
CREATE TABLE IF NOT EXISTS lookout_mcp_connections (
 id bigserial PRIMARY KEY,
 organisation_id bigint NOT NULL REFERENCES lookout_organisations(id) ON DELETE CASCADE,
 user_id bigint REFERENCES lookout_users(id) ON DELETE SET NULL,
 client_id text NOT NULL,
 display_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS lookout_mcp_grants (
 connection_id bigint NOT NULL REFERENCES lookout_mcp_connections(id) ON DELETE CASCADE,
 portfolio_project_id integer REFERENCES portfolio_projects(id) ON DELETE CASCADE,
 scope text NOT NULL CHECK(scope IN ('portfolio:read','project:read','contribution:write')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((scope='portfolio:read' AND portfolio_project_id IS NULL) OR
        (scope<>'portfolio:read' AND portfolio_project_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS lookout_mcp_grants_dedupe ON lookout_mcp_grants(connection_id,coalesce(portfolio_project_id,0),scope);
CREATE INDEX IF NOT EXISTS lookout_project_access_org_idx ON lookout_project_access(organisation_id);
CREATE INDEX IF NOT EXISTS lookout_mcp_connections_org_idx ON lookout_mcp_connections(organisation_id);
