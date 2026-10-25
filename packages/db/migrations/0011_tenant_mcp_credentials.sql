-- Additive read-only organisation MCP credentials.
-- Secrets are stored as SHA-256 digests, never as cleartext.
ALTER TABLE lookout_mcp_connections ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE lookout_mcp_connections ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS lookout_mcp_connection_hash_uq ON lookout_mcp_connections(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS lookout_mcp_connection_expires_idx ON lookout_mcp_connections(expires_at) WHERE revoked_at IS NULL;
