-- Personal OAuth. Codes and tokens stored only as SHA-256 fingerprints.
CREATE TABLE IF NOT EXISTS lookout_oauth_codes (
  code_hash text PRIMARY KEY, client_id text NOT NULL, redirect_uri text NOT NULL,
  code_challenge text NOT NULL, resource text NOT NULL, scope text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lookout_oauth_codes_expires_idx ON lookout_oauth_codes(expires_at);
CREATE TABLE IF NOT EXISTS lookout_oauth_access_tokens (
  token_hash text PRIMARY KEY, client_id text NOT NULL, resource text NOT NULL,
  scope text NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lookout_oauth_access_expires_idx ON lookout_oauth_access_tokens(expires_at);
CREATE TABLE IF NOT EXISTS lookout_oauth_refresh_tokens (
  token_hash text PRIMARY KEY, client_id text NOT NULL, resource text NOT NULL,
  scope text NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lookout_oauth_refresh_expires_idx ON lookout_oauth_refresh_tokens(expires_at);
