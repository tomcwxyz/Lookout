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

## Connecting to ChatGPT

ChatGPT custom MCP access depends on the account and workspace. This pilot uses a **fixed Bearer credential**, not OAuth. Some ChatGPT connection flows require OAuth 2.1 and will not accept a fixed API key. Do not disable authentication or place credentials in URLs as a workaround.

If a custom MCP connection supports fixed Bearer credentials, use the endpoint above and supply the credential in its secure authentication field. Otherwise OAuth 2.1 (PKCE, refresh tokens and consent) is a separate next phase. MCP Inspector and other HTTP clients can still test the pilot.

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
