# Lookout multi-user, organisation and scoped MCP migration

## Current security boundary
The current production app remains **single-owner**: Basic-auth dashboard, a global GitHub discovery token, owner OAuth portfolio access, and repository-scoped agent tokens. Merely adding users to this model would leak another tenant's GitHub inventory, infrastructure and reports. **Migration 0010 is schema-only and must not be described as multi-user authentication.**

## Product model
- A user is an authenticated individual with a verified external subject (identity provider issuer + subject). Email is display/contact data, not an authorisation key.
- An organisation owns connected providers, logical projects, billing and its membership roster. Users can belong to multiple organisations; role is per organisation.
- A project belongs to one organisation for initial GA (schema provides an access link; enforce one owner when migrating). Sharing across organisations requires explicit future design.
- An MCP connection has an owner user/organisation, visible name, revocation and individual grants. Read and append-contribution are separate actions.
- Human-confirmed project state may only be changed through separate permission; append-only contribution does not imply status write.

## Release phases and hard gates
1. **Foundation (PR):** additive tables for organisations, users, verified identity links, memberships, project access and per-connection grants; pure deny-by-default policy tests. No migration applied to production yet.
2. **Identity:** select an OIDC authentication provider (Neon Auth is a candidate), implement verified server-side sessions, login/signup/logout, invitations and membership management. Remove Basic auth only after these are exercised with test accounts. Never use email from a request parameter/header as identity.
3. **Tenant fencing:** add organisation ownership and row filtering to all repository, project, infrastructure, attention and reporting queries, as well as sync jobs and API handlers. This includes legacy tables (projects, inventory, infrastructure, scans, agent tokens, OAuth codes/tokens and contributions). Backfill existing portfolio into a single private owner organisation with a verified existing user. Do not automatically share it with new signups.
4. **OAuth + MCP:** per-user OIDC login during OAuth consent, bind access/refresh tokens to membership and connection identity, require explicit project grants and current membership on **every** MCP call. Scope separate `portfolio:read`, `project:read`, `contribution:write`. Refresh must not restore revoked access. Audit all contributions by identity/connection and allow easy revocation.
5. **Provider installs:** GitHub App installations, Vercel, Neon credentials and scheduled observations belong to an organisation. No global provider token may be shared across tenants; a tenant must not be able to fetch another tenant's repo using a guessed ID.
6. **Acceptance before enabling real accounts:** two organisations with private repositories and projects; cross-org enumeration, MCP project ID guessing, token revocation, workspace switching, invitations, role changes, stale sessions, per-provider discovery and ownership transfer all denied unless explicitly authorised.

## Guardrails
- Do not create a public signup page against the current single-tenant handlers.
- Do not apply `0010_multi_tenant_foundation.sql` without an explicit migration review/backfill plan.
- Do not migrate owner OAuth tokens or bearer credentials to shared user accounts.
- Never rely solely on UI project selectors, client-side policies or a self-reported email.
- Grant evaluation helper is preliminary; it is **not wired into production route handlers** until identity and tenant-scoped queries exist.

## Proposed account roles
Owner (billing/organisation management), admin (members/connectors), member (reports/work), viewer (read only). Per-project MCP grants may further restrict each role. Human status edits and external writes should be separate explicit capabilities in a future phase.

## Initial UI journey
Create account → create/join organisation → connect a GitHub installation → discover only that organisation's repos → group logical projects → create ChatGPT OAuth connection with selectable projects and read/contribute grants → view/revoke per-device/agent connections. Every screen should clearly show the active organisation and project scope.
