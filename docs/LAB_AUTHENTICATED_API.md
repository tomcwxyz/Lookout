# Authenticated tenant lab API (not a public sign-up)

Route: `GET /api/lab/workspace?organisationId=<id>` (disabled by default).

The request must supply an independently issued JWT as `Authorization: Bearer <jwt>`. The server checks the RSA-SHA256 signature against Neon Auth's JWKS, issuer, audience, timestamps, and current `lookout_auth_identities` / organisation membership before querying projects. No client-controlled email or subject is trusted.

Lab Vercel environment variables (preview only):
- `LOOKOUT_MULTIUSER_LAB=enabled`
- `LOOKOUT_LAB_JWT_ISSUER`: exact issuer in the **real** JWT claims
- `LOOKOUT_LAB_JWT_AUDIENCE`: exact audience in the **real** JWT claims
- `LOOKOUT_LAB_JWKS_URL`: HTTPS JWKS endpoint on same hostname as issuer
- `DATABASE_URL`: connection to the isolated lab branch only

**Important:** Neon Auth's supported SDK must be configured separately to sign users in and request tokens. This route does not mint JWTs, accept passwords, or create accounts. The verifier currently supports RS256 only: inspect a real Neon Auth token header first, then add support for the observed algorithm with tests before using this lab route. Never weaken signing validation to allow a mismatched token.

Production Basic auth, owner OAuth MCP and global portfolio queries remain unchanged. Do not set the lab feature flag on the production deployment; use a separately configured and access-restricted preview environment.

Acceptance checks: disabled flag returns 404; missing/tampered tokens denied; user A sees organisation A only; user B cannot request organisation A or guess project IDs; revoked member denied; no legacy unassigned project returned. This is not yet complete tenant isolation across the application.
