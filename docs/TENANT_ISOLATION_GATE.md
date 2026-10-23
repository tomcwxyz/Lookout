# Tenant-boundary integration phase

The helpers in `packages/db/src/tenant-repository.ts` intentionally fail closed:
- Verified `issuer` + `subject` resolve an organisation membership, never a request-supplied email.
- Portfolio retrieval requires explicit `lookout_project_access` for the selected organisation.
- Empty/unassigned projects are private, not shared.

**This does not yet make Lookout safe for multi-user sign-up.** Existing `getPortfolio`, `getProject`, `getLogicalPortfolio`, infrastructure queries, GitHub synchronisation, account routes, hosted MCP OAuth and scheduled jobs still operate in single-owner mode.

## Next implementation gates
1. Provision Neon Auth in an isolated testing branch and configure trusted test domains. Do not enable production sign-up.
2. Build sign-in/out and verified-session route guards, with separate session identity and organisation membership.
3. Backfill existing projects and provider observations into a private legacy owner organisation, after ownership review.
4. Replace each currently global loader and mutator with verified tenant-scoped equivalents; deny missing tenant context. Protect direct API, worker, OAuth and MCP calls, not merely the UI.
5. Only then permit test accounts, organisation switching and invitations.

## Required isolation tests
Two accounts in different organisations. Test guessed repository, portfolio, contribution, agent-token, infrastructure IDs; revoked membership; wrong connection grants; OAuth refresh after revocation; cross-tenant inventory scans. Assert no data returns, no writes occur, and errors do not leak existence.

Neon Auth docs: https://github.com/neondatabase/neon-js/blob/main/packages/auth/NEXT-JS.md
