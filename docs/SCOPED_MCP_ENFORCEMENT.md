# Multi-tenant MCP: verified authorisation boundary

This slice adds database checks for connection memberships and contribution visibility.

`resolveActiveMcpGrant(connectionId, organisationId, projectId, capability)` checks all at once:
- Connection is active and belongs to the specified organisation
- Connected user is active and still a member of the organisation
- Project is explicitly assigned to that organisation
- Connection has an explicit project permission; portfolio read never implies write
- Viewer members cannot submit contributions

`listTenantChatgptContributions` filters contribution retrieval through project ownership.

**Do not expose these helpers directly to clients**. The connection ID and organisation ID must be derived by a server-authorised OAuth token lookup. A caller-supplied connectionId would allow impersonation if trusted.

## Identity integration gap

Production still uses a single-owner Basic dashboard and its original OAuth tokens. Current OAuth access-token storage records client_id/scope but no authenticated user or organisation. Do not silently translate those credentials into multi-user sessions. Before switching:
- Add verified Neon Auth server session adapters for preview (lab branch only).
- Bind each OAuth code, access and refresh token to a real user, organisation and connection, including OAuth consent.
- Enforce revocation against membership on every request/refresh.
- Replace global queries across all MCP tools, web routes, workers and provider integrations.
- Backfill legacy data into a private owner organisation and explicitly allocate provider credentials.
- End-to-end test two organisations, two accounts and project ID guessing, including direct MCP requests.

No new public authentication or sign-up routes are exposed by this change.
