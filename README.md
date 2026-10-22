# Lookout

**Know where everything stands.**

Lookout is an open-source, agent-led software project observer. It brings together source-linked GitHub activity, Neon and Vercel infrastructure observations, human progress decisions and portable coding-agent handovers. Its purpose is to answer **what changed, where did we leave things, what is verified and what needs attention?**

**Current status (21 October 2026): working single-user alpha.** The [production dashboard](https://lookout-eosin.vercel.app) is deployed on Vercel; GitHub, Neon and Vercel scheduled observations are operating. Its core checks and deployment pipeline are tested. Agent-assisted handovers are implemented, but require end-to-end testing with real connected coding assistants.

## What is available

| Area | Status |
| --- | --- |
| GitHub repository, branch, PR, issue and workflow observations | Operating; bounded by per-source limits |
| Neon projects, branches and compute inventory | Operating; no billing claims or migration verification |
| Vercel projects and latest deployments by environment | Operating; source-linked error/blocked findings |
| Scheduled observations and authenticated manual scans | Operating, with per-provider concurrency leases |
| Evidence-backed project work queue and PR discussion summaries | Implemented; incomplete source sampling is disclosed |
| Human-confirmed work statuses with optional next-step notes | Implemented; survive subsequent scans |
| Project-scoped coding-agent tokens, checkpoint timeline and handover API | Implemented; real-agent use not yet proven |
| Local portfolio MCP and published remote bridge | Available; `@good-ship/lookout-mcp@0.2.0` |
| Optional AI project briefs | Available when AI Gateway is configured |

For full details see [work handovers](docs/WORK_HANDOVERS.md), [agent handovers](docs/AGENT_HANDOVERS.md), [MCP](docs/MCP.md), [infrastructure](docs/INFRASTRUCTURE.md) and the [roadmap](docs/ROADMAP.md).

## Architecture

- **Web:** Next.js dashboard with portfolio attention, project pages, work decisions, project-scoped connections and infrastructure inventory.
- **Observers:** read-only GitHub, Neon and Vercel adapters; manual and scheduled execution.
- **Core:** typed observations and deterministic, evidence-linked assessments.
- **Database:** Postgres + Drizzle; Lookout only writes to **its own** database.
- **Agents:** an optional AI brief generator, local MCP for portfolio access and a published npm MCP bridge for scoped remote project handovers.

A merged PR is not automatically *accepted* or *deployed*. A stale branch is a review signal, not deletion advice. An agent's checkpoint is a **claim**, not verified completion. Lookout does **not** merge PRs, delete branches, deploy applications or run migrations against monitored projects.

## Use the hosted alpha

Open [Lookout](https://lookout-eosin.vercel.app), sign in with the configured dashboard credentials and review **Work to pick up**, project pages and **Infrastructure**. Use **Scan all** or scan a single provider for an on-demand refresh.

To connect a coding assistant, open a project and choose **Connect your coding assistant**. Create a project-scoped token and copy the generated Codex / Claude Code setup command, or configure another MCP client with `LOOKOUT_API_URL`, `LOOKOUT_API_TOKEN` and `npx -y @good-ship/lookout-mcp@0.2.0`. The token is shown once; keep it private and revoke it when no longer needed. **No repository checkout or database credentials are needed for this bridge.** See [agent handovers](docs/AGENT_HANDOVERS.md).

## Self-hosted development

Requirements: Node.js 22+ (production currently uses Node 24), npm 10+, Postgres 15+ and a read-only GitHub token.

```bash
git clone https://github.com/tomcwxyz/Lookout.git
cd Lookout
npm install
cp .env.example .env
# Set DATABASE_URL and GITHUB_TOKEN in .env
npm run db:migrate
npm run sync
npm run dev
```

Open http://localhost:3000. There is no synthetic project data before the first successful scan.

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm run sync
npm run worker
npm run mcp
```

Set `NEON_API_KEY` and/or `VERCEL_API_TOKEN` (and the corresponding organisation/team selectors) to enable cloud inventory. For Vercel production set `CRON_SECRET` and see [scheduled observation](docs/SCHEDULED_SYNC.md). The standalone polling worker is an alternative to Vercel cron.

Key settings: `DATABASE_URL`, `GITHUB_TOKEN`, optional `GITHUB_OWNER`, `LOOKOUT_MAX_REPOS` (default **25**), `LOOKOUT_STALE_BRANCH_DAYS`, `LOOKOUT_STALE_PR_DAYS`, `LOOKOUT_DASHBOARD_TOKEN`, `NEON_API_KEY`, `NEON_ORG_ID`, `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`, `CRON_SECRET` and optional `AI_GATEWAY_API_KEY` / `LOOKOUT_AI_MODEL`. See [`.env.example`](.env.example) for the current full list.

## Boundaries and next work

- Repo, branch, PR, issue and plan discovery is deliberately capped; **a sampled inventory is not a complete inventory**. GitHub defaults to 25 recently pushed repositories.
- Infrastructure observations identify status and ageing but do not prove cost, inactivity, migration application or release acceptance.
- Each GitHub repository currently stands for one observed project. Multiple repositories/services cannot yet be unified into one logical feature/project model.
- A subset of PR bodies, discussion, issues and Markdown plans inform work handovers. External documents, feature grouping and authoritative-plan selection are not yet implemented.
- Agent connections and checkpoints are proposal-only and require live acceptance testing. No background end-of-session capture or default TOPO personal-memory ingestion.
- The protected single-user Basic Auth dashboard is not a team-ready authentication model.

**Next priorities:** validate real cross-agent handovers; group work by features and evidence; verify deployments/migrations with permissions; improve coverage, alert policies and documentation freshness. See [ROADMAP](docs/ROADMAP.md).

Apache-2.0. See [LICENSE](LICENSE).

## Portfolio projects and broader GitHub coverage (October 2026)

The `/portfolio` screen shows **logical projects**, separate from GitHub repository observations. It supports human-confirmed lifecycle states (exploring, building, testing, live, maintaining, paused, archived), optional notes, projects without code, many-repository grouping, and explicit Neon/Vercel resource association. Observations never overwrite confirmed status.

Lookout now inventories up to 500 repositories visible to its own GitHub token (public and authorised private), then inspects a rotating batch of 15 in detail each hour. The UI and ChatGPT MCP list both report inventory and detailed-inspection coverage, including failed inspections. Private access depends on the token permissions; an inaccessible repository is not proof that it does not exist.

Apply the additive migration `0007_portfolio_inventory.sql` to Lookout's own database before deploying. See [scheduled sync](docs/SCHEDULED_SYNC.md) for batch sizing and access notes.
