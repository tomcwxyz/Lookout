# Lookout architecture

_Updated 22 October 2026._

## Principle

Sources provide observations; pure rules interpret bounded evidence; AI can explain but never promote unverified claims into facts. Git merge, CI success, Vercel deployment state, human sign-off and agent-reported work are separate evidence types.

## Implemented layers

1. **Provider connectors** (`packages/connectors`): read-only GitHub, Neon and Vercel API adapters, explicit attribution and bounded source sampling.
2. **Core** (`packages/core`): deterministic rules for branch/PR attention, infrastructure findings, PR discussion extraction, work status and portable checkpoint validation.
3. **Persistence** (`packages/db`): Drizzle/Postgres snapshots, sync records, attention state, resource links, scan leases, human decisions, project-scoped token hashes and append-only checkpoint events.
4. **Web** (`apps/web`): server-rendered portfolio, work handovers, explicit human status confirmations, activity timeline, credentials-protected connection management, scan controls and infrastructure page.
5. **Observation runtime** (`apps/worker`, `apps/web/app/api/cron`): independent polling or three staggered, six-hour Vercel Cron Jobs. Both use per-provider database leases.
6. **Agent interfaces** (`apps/mcp`, `packages/lookout-mcp`): local database-backed portfolio MCP and standalone npm remote MCP client bridge to project-scoped HTTPS APIs. Optional AI briefs via AI Gateway (`packages/agents`).

## Evidence and identity

GitHub repository -> observed project -> sampled PRs, issues, branches, CI and plans -> deterministic work/attention suggestions. Human decisions live in a separate authoritative table. A project can link read-only infrastructure resources, with exact Vercel/Git identity when provided and explicit manual links for ambiguous relationships. Logical portfolio projects are now separate from observed repositories. Each accessible repository is inventoried quickly, then inspected in bounded rotating batches; one logical project can own multiple repository links and explicit infrastructure links. Lifecycle state is nullable until confirmed by the user and is never inferred from code activity.

For agent handovers, dashboard-authenticated users issue scoped revocable bearer tokens. A coding assistant uses the bridge to fetch a limited handover, human decisions and next actions or **propose** a validated, idempotent checkpoint. Records are labelled agent-reported and do not alter human-confirmed status. No raw conversation transcript or TOPO personal memory is ingested.

## Trust boundaries

- GitHub, Neon and Vercel observer credentials are used only for permitted reads. Lookout does not mutate monitored infrastructure.
- The dashboard requires single-user Basic Auth; scheduled GET endpoints use a different `CRON_SECRET`; manual POST scan routes also check same-origin.
- Agent API routes are bearer-protected and project-scoped. Store only hashed token material and show secrets once.
- Missing or failed provider access is **unknown**, never green. Incomplete scans never imply that unobserved projects were deleted.
- PR bodies, comments, Markdown plans and agent checkpoints are untrusted text. Claims of tests or completion require independent evidence or human confirmation.
- Merge does not mean deployed; age does not prove database inactivity; provider error/blocking is not proof an entire service is unusable.
- Migration files and applied DB migration state are separate; verification against observed production databases is not implemented.

## Present limits

The observer inventories up to 500 accessible repositories but inspects only a bounded rotating subset per run, with bounded PR review/discussion samples and a small selection of conventional Markdown plan files. The dashboard presently highlights technical work signals rather than stable cross-source feature groups. There are no team roles, automatic agent lifecycle hooks, cross-provider transactional edits or destructive automations. External planning documents are not yet ingested.

See [ROADMAP](ROADMAP.md), [SCHEDULED_SYNC](SCHEDULED_SYNC.md), [WORK_HANDOVERS](WORK_HANDOVERS.md) and [AGENT_HANDOVERS](AGENT_HANDOVERS.md).
