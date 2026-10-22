# Scheduled and manual observation

_Updated 21 October 2026. The production Lookout instance is running scheduled GitHub, Neon and Vercel observations._

## Production

Vercel project `lookout`, application root `apps/web`, uses its own `DATABASE_URL`, not a provider project's database URL. The hosted dashboard is at https://lookout-eosin.vercel.app.

Required/supported server-side variables:
- `DATABASE_URL` — Lookout's own Postgres database;
- `LOOKOUT_DASHBOARD_TOKEN` — single-user Basic Auth;
- `GITHUB_TOKEN`, optional `GITHUB_OWNER` — read-only GitHub discovery;
- `NEON_API_KEY`, optional `NEON_ORG_ID` — read-only Neon inventory;
- `VERCEL_API_TOKEN`, optional `VERCEL_TEAM_ID` — read-only Vercel inventory;
- `CRON_SECRET` — separate randomly generated secret, at least 32 characters, for Vercel Cron;
- optional AI Gateway settings for briefs.

All provider credentials stay server-side. The dashboard and cloud collectors do not mutate provider resources.

GitHub discovery now runs **hourly at minute 00**; Neon and Vercel continue every six hours at minutes 20 and 40 respectively. Each GET cron route validates `Authorization: Bearer <CRON_SECRET>` independently of dashboard Basic Auth. The runtime requests up to 300 seconds, subject to plan limits.

**Live verification (21 October 2026):** Lookout's own database shows successfully completed GitHub, Neon and Vercel scheduled runs. The production web deployment was READY and Lookout schema migrations `0001` through `0005` were applied. These observations do not independently verify each monitored application's health or database migrations.

## Manual scans

**Scan all** and individual provider buttons use authenticated, same-origin POST routes at `/api/scan/github`, `/api/scan/neon` and `/api/scan/vercel`. Manual scans and cron collectors share per-provider atomic database leases (migration `0003_observation_locks.sql`); duplicate concurrent scans yield HTTP 409. Leases expire after 10 minutes, and an unusually large sync can still hit serverless request limits.

For local development run `npm run sync`; the separate `npm run worker` provides a worker scheduler without Vercel. Configure credentials locally without committing `.env`.

## Coverage / interpretation

GitHub repository inventory defaults to **up to 500 accessible repositories** via `LOOKOUT_MAX_REPOS`, including private repositories only when `GITHUB_TOKEN` permits access. The list is captured on each scan; the expensive per-repository detail scan is **15 repositories per run** by default (`LOOKOUT_GITHUB_BATCH_SIZE`, bounded 1–30) and rotates through the inventory via `github_scan_state`. Set `LOOKOUT_MAX_BRANCHES_PER_REPO` to control branch sampling (default 15). At 75 repositories, a full detailed pass takes about five hourly successful runs. Do not treat newly discovered, not-yet-inspected repositories as healthy, broken, or inactive. Failures preserve last good evidence and are shown as coverage errors. No repository is deleted merely because it is absent from a later listing. Private repo access must be granted to the Lookout **production GitHub token**, not merely to ChatGPT's GitHub connector.

Logical portfolio projects are first-class: `/portfolio` lists all discovered projects plus manually created projects. A project can group multiple repositories and link Neon/Vercel resources; human-confirmed lifecycle status is separate from GitHub evidence. The additive `0007_portfolio_inventory.sql` migration backfills existing observed repositories and keeps all existing agent tokens, work decisions and infrastructure links. Apply this migration to Lookout's **own** database before deploying the new version.

Check Vercel project Cron Jobs, Lookout `sync_runs` / `source_sync_runs`, UI timestamps and Vercel logs when debugging. Provider error states, branch age and work inference are prompts for review, not a basis for automatic destructive action.
