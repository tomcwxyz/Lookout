# Hosted Lookout MCP — personal pilot

Read-only HTTPS MCP for a personal Lookout portfolio, with single-project access for existing agent tokens.

Endpoint: https://lookout-eosin.vercel.app/api/mcp

## Private owner setup

The dashboard Basic-auth password is NOT a hosted MCP credential.

1. Generate a separate random token locally in Git Bash: `openssl rand -hex 32`.
   Alternatively use Node: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. In Vercel project `lookout`, add `LOOKOUT_MCP_OWNER_TOKEN` with that value, scoped to Production.
3. Redeploy production after saving the variable.
4. Store the value in a password manager. This is the full **read-only portfolio** credential. Never paste it into public chats, shell history or Git.
5. For project-only testing, use an existing `lkp_...` token generated on a Lookout project page instead.

Every MCP POST must include `Authorization: Bearer <token>`. Requests without valid credentials return 401. The personal token must be at least 48 characters (64 random hex characters recommended). Project tokens are restricted to one project, even if a different project ID is supplied.

## Test independently of ChatGPT

Use MCP Inspector (`npx @modelcontextprotocol/inspector@latest`) or a compatible HTTP MCP client. Select **Streamable HTTP**, enter the endpoint and configure the `Authorization` header privately. Check `lookout_whoami`, then `lookout_list_projects`, `lookout_list_attention` and `lookout_get_project_context`.

Test missing/incorrect tokens (401), project isolation and owner access. Do not share DATABASE_URL or dashboard credentials with the client.

Raw protocol initialization example (send as authenticated POST with `Accept: application/json, text/event-stream` and `Content-Type: application/json`):

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual-test","version":"1"}}}
```

## Connecting to ChatGPT via OAuth (personal pilot)

ChatGPT's custom MCP plugin uses OAuth 2.1 rather than a custom Bearer
credential. Lookout now implements OAuth discovery, authorisation code with
S256 PKCE, consent, one-hour access tokens and rotating refresh tokens (30-day
lifetime). ChatGPT can use its Client ID Metadata Document (CIMD); only
ChatGPT-hosted clients and verified redirect URIs are allowed in this pilot.

1. In ChatGPT Plugins choose **Add custom MCP server**.
2. Name it **Lookout** and enter the Server URL
   `https://lookout-eosin.vercel.app/api/mcp`.
3. Choose **OAuth** and accept the risk acknowledgement.
4. When prompted to authorise, use your Lookout dashboard Basic-auth
   credentials (username `lookout`, password from your existing dashboard).
5. Review the read-only consent screen and select **Allow read-only access**.
6. Install the resulting plugin and test with `@Lookout` in a new chat.

ChatGPT does **not** need `LOOKOUT_MCP_OWNER_TOKEN`. Keep that secret for
compatible non-OAuth MCP clients. Never choose "No authentication" for the
personal portfolio.

**OAuth implementation:** The server publishes
`/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server`; access and refresh tokens are
stored as SHA-256 fingerprints in the Lookout-owned Neon database, not in
ChatGPT. OAuth scopes are `lookout:read offline_access`; every tool is
read-only. Existing project-scoped agent tokens remain restricted.

**Pilot limitations:** One dashboard owner; no independent user accounts.
The Basic-auth password is used to confirm consent. To disconnect OAuth
sessions immediately, use the **Disconnect all ChatGPT OAuth sessions** button on Lookout's Web chat connection page;
changing the separate owner Bearer token does not revoke OAuth sessions.
For general public use, adopt a managed OAuth identity provider and
per-user permissions.

## Tools (all read-only)

- `lookout_whoami` — verify scope
- `lookout_list_projects` — portfolio or one project
- `lookout_list_attention` — current findings and source URLs
- `lookout_get_project_context` — PRs, CI, work, decisions
- `lookout_get_handover` — recent checkpoints and decisions
- `lookout_get_next_actions` — candidate next steps
- `lookout_list_infrastructure` — redacted provider summaries

Tool responses are bounded and omit raw provider snapshots and secrets. Agent self-reports, observed Git/CI evidence and human decisions remain distinct.

## Security and future work

The owner token is long-lived and can be rotated by changing the Vercel environment variable and redeploying. Project tokens can be revoked in Lookout. Future multi-user support requires OAuth, per-user permissions, audit logs, rate limiting and scoped token revocation. This pilot is not multi-tenant.
