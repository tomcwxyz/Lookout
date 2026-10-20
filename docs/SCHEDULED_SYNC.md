# Lookout scheduled observation (Vercel)

The dashboard and the collectors share Lookout's own DATABASE_URL, but collectors are **read-only** against GitHub, Neon, and Vercel. No provider resource is modified.

## Production setup

Use Vercel project `lookout` with root directory `apps/web`.

- DATABASE_URL — Lookout's own PostgreSQL database
- LOOKOUT_DASHBOARD_TOKEN — Basic Auth password for the dashboard
- GITHUB_TOKEN, GITHUB_OWNER — repository discovery
- NEON_API_KEY, NEON_ORG_ID — Neon inventory
- VERCEL_API_TOKEN, VERCEL_TEAM_ID — Vercel deployment inventory
- CRON_SECRET — a separate, randomly generated secret with at least 32 characters, scoped to Production only; required for scheduled runs

Keep all tokens as server-side sensitive variables. Never expose them in source or client-side environment variables.

Three cron entries in `apps/web/vercel.json` run at 00, 20, and 40 minutes past every sixth hour (UTC). Vercel invokes each production GET with `Authorization: Bearer <CRON_SECRET>`. Middleware skips dashboard Basic Auth only for the three scheduled routes. Each route **independently verifies** the bearer token and rejects requests without it. When credentials are missing, the route fails closed. The functions use Node.js runtime, with a requested 300-second max duration. Actual limits depend on the Vercel plan.

Verification:
1. Confirm production deployment is READY and Cron Jobs are listed in Vercel Settings.
2. Review the protected dashboard; after cron runs, inspect project and infrastructure observations.
3. Check `sync_runs` and `source_sync_runs` in Lookout's Neon database for completion/errors.
4. Review Vercel function logs if source syncs fail. No provider credentials are included in HTTP responses.

Local manual bootstrap: `npm run sync` with database and provider tokens in a local, uncommitted `.env`.

Limitations: The first GitHub sweep scans the 25 most recently pushed repositories by default; `LOOKOUT_MAX_REPOS` can change this. A sync may take time when there are many repos/branches, and missing projects from a capped scan are not treated as deleted. Cron runs are not retroactively triggered when deploying; the first real observation occurs at the next scheduled invocation or a local manual sync.

## User-initiated observations

The dashboard and infrastructure view include **Scan all** and individual provider buttons. These send authenticated same-origin POST requests to /api/scan/github, /api/scan/neon, and /api/scan/vercel. Dashboard Basic Auth remains required; provider API credentials never reach the browser. Exact Origin checking protects against CSRF. Each result reports the resource count and refreshes the dashboard.

Manual and scheduled scans share the same per-provider atomic database lease (migration 0003). An overlapping scan receives HTTP 409. Leases expire after 10 minutes if a serverless process is interrupted. Serverless functions request up to 300 seconds, subject to Vercel plan limits. The scan endpoint requires a live connection until completion and can time out on large portfolios. Use scheduled syncs for ongoing monitoring.
