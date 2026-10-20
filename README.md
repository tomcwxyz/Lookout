# Lookout

**Know where everything stands.**

Lookout is an open-source, agent-led project observer. It gathers evidence about software projects, highlights unfinished work and provides short, grounded handovers so you can pick up where you left off.

The first alpha includes a **local stdio MCP server** (npm run mcp, see docs/MCP.md). It supports read-only project context and optionally idea capture.

The first alpha supports **GitHub discovery**, ageing branch and PR checks, latest workflow failure detection, an attention inbox, project drill-down, quick idea capture and optional AI-generated briefs. **Neon and Vercel observation are planned connectors, not yet live.**

## Architecture

- Next.js web interface (responsive, read-only observations)
- Independent TypeScript worker for periodic GitHub discovery
- Postgres + Drizzle, compatible with Neon or self-hosted Postgres
- Rule-based attention detection with evidence links and idempotent resolution
- Optional AI historian (Vercel AI SDK v6 / AI Gateway); disabled unless configured
- Adapter interface for adding other Git providers, databases and deployment sources

Lookout **does not** delete branches, merge PRs, change databases, or deploy code.

## Quick start

Requirements: Node.js 22+, npm 10+, Postgres 15+ and a GitHub access token.

1. Clone this repository and run: npm install
2. Copy .env.example to .env.
3. Set DATABASE_URL and GITHUB_TOKEN. For GitHub, prefer a fine-grained, read-only token scoped only to the repositories you want to observe. Repository metadata and read access to commits, pull requests, issues and Actions are needed for full coverage. Do not give write scopes.
4. Run: npm run db:migrate
5. Run: npm run sync
6. Run: npm run dev and open http://localhost:3000.

The dashboard shows **no fabricated project data** before the first sync.

To enable AI briefs, set AI_GATEWAY_API_KEY and LOOKOUT_AI_MODEL to a currently supported gateway model ID (provider/model). AI is optional; all deterministic checks work without it. Briefs are only regenerated when observations change, to limit cost.

To enable periodic observation, run npm run worker separately (default every 60 minutes). The worker is independent of Vercel and suitable for a service container. For production, use a supervisor; do not depend on a web request to keep it running.

## Configuration

| Variable | Meaning |
| --- | --- |
| DATABASE_URL | Postgres connection URI |
| GITHUB_TOKEN | Read-only GitHub token |
| GITHUB_OWNER | Optional owner filter; omit to inspect accessible repositories |
| LOOKOUT_MAX_REPOS | Maximum repositories per sync (default 25) |
| LOOKOUT_STALE_BRANCH_DAYS | Branch inactivity threshold (default 14) |
| LOOKOUT_STALE_PR_DAYS | PR inactivity threshold (default 14) |
| LOOKOUT_INCLUDE_FORKS | Include forked repositories (default false) |
| LOOKOUT_POLL_MINUTES | Watcher interval, minimum 15 |
| LOOKOUT_DASHBOARD_TOKEN | Production dashboard Basic-auth password |
| AI_GATEWAY_API_KEY | Optional AI Gateway credential |
| LOOKOUT_AI_MODEL | Optional gateway model ID |

Production requests fail closed unless LOOKOUT_DASHBOARD_TOKEN is set. Use HTTPS; single-user Basic authentication is **temporary**, not the target team auth model. Never expose GITHUB_TOKEN or DATABASE_URL in client-side environment variables.

## Safety and scope

- GitHub token is only used for **GET** requests in the observer.
- A stale branch is a **review suggestion**, not evidence that deletion is safe.
- Missing timestamps remain unknown; unavailable Actions data does not count as passing CI.
- An incomplete sync never resolves previous alerts for a project that was not inspected.
- Open issues are counted, but a GitHub Issues endpoint returns PRs too; these are filtered out.
- The branch observer examines at most 25 branches per repository and the first 100 open PRs/issues in this alpha; numbers are observed counts, **not a complete inventory** of very large repositories.
- Migration state, cloud costs and deployment readiness cannot be asserted until dedicated read-only adapters and permissions are connected.
- Repo text used in AI summaries is untrusted input. AI output is labelled and cannot take actions.

## Commands

- npm run dev — web UI
- npm run sync — one-off observation
- npm run worker — continuous polling worker
- npm run db:migrate — initial database schema
- npm run typecheck — TypeScript checking
- npm test — rule and adapter tests
- npm run build — production web build

## Next milestones

1. Expand GitHub pagination, failure isolation and repository-to-project grouping.
2. Add Neon branch, compute and usage observation with explicit resource linking and cost evidence.
3. Add Vercel deployment and environment observation.
4. Correlate Git branches, DB branches, PRs and previews.
5. Add migration verification via read-only applied-migration queries.
6. Add MCP tools, configurable automations, proper accounts, RBAC and multi-source Git.

See docs/ARCHITECTURE.md for design principles and docs/ROADMAP.md for build stages.

Apache-2.0. See LICENSE.
