# Multi-user lab — current integration steps

Neon branch: `lookout-multiuser-auth-lab` (production remains on `br-cool-dream-zau8fd06`).
Neon Auth Better Auth service is provisioned **only on the lab branch**. Migration 0010 is applied there.

`onboardVerifiedIdentity` now supports atomic creation of a user + owner organisation + verified external identity. This operation must **not be exposed as a public API** until server-side Neon Auth session verification is implemented. It deliberately rejects account/email collisions and organisation slug takeover.

## Required next end-to-end slice

1. Configure an isolated Vercel preview to point to the lab DB and Neon Auth URL; do not reuse production env.
2. Integrate the supported Neon Auth Next.js server/session adapter, using authenticated server-side verification. Do not trust browser-submitted email, issuer or subject.
3. Add login, sign-up, sign-out and account screens on lab preview only; call `onboardVerifiedIdentity` from a verified server session (not directly from client).
4. Implement organisation selection from DB membership, with a cryptographically authenticated session, not a user-supplied organisation id.
5. Replace global portfolio, project, inventory, provider, agent contribution, token and MCP queries with tenant-fenced lookups; test all direct API routes.
6. Connect per-user MCP OAuth grants, enforcement on every read/write tool, refresh revocation and audit.
7. Exercise two isolated accounts/organisations, account disable, organisation role change, connection revocation and cross-project ID guessing.
8. Only when isolation is proven, design migration of legacy portfolio to one private user-owned organisation.

Current `LOOKOUT_DASHBOARD_TOKEN` Basic-auth middleware still guards existing production pages and remains unchanged. No open registration is enabled.

Reference: https://neon.com/docs/neon-auth/quick-start/nextjs
