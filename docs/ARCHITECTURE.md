# Lookout architecture

## Core principle

Facts come from adapters and verifiable observations; rules are deterministic; AI explains the evidence and suggests decisions. The language model must never be the source of truth for a branch's state, an applied migration, a cloud bill or a deployment.

## Layers

- **Connectors:** read-only provider adapters. An adapter returns typed snapshots and links to evidence. Providers and credentials are scoped independently.
- **Core:** pure TypeScript schemas and assessment functions. No external API calls or database requirements.
- **Persistence:** Drizzle schema, Postgres snapshots, alerts, sync runs and ideas. Alert keys are stable within each project; no speculative resolution after failed scans.
- **Agents:** optional LLM brief generator. Gateway model chosen at runtime. Deterministic checks are useful even with AI disabled.
- **Worker:** scheduled sync outside the request lifecycle. No Vercel cron dependency.
- **Web:** attention-first overview, observed project information, and quick idea capture. Early production version is single-user protected.

## Data flow

GitHub API -> typed ProjectSnapshot -> pure assessProject -> change-aware AI brief -> transactional snapshot and attention upsert -> server-rendered attention inbox.

In this alpha one repository corresponds to one observed project. Later a user-facing project can group multiple repositories, Neon projects, Vercel apps and tracked work. Model this as separately identified resources with explicit and proposed edges. Never assume similar names imply identity.

## Planned database and deployment observation

Provide a read-only Neon adapter which inventories database branches, their parent references, creation and compute activity. Prefer actual bill/usage fields over estimates. A cost recommendation must identify the metering source and billing period.

Provide a Vercel adapter for current deployments, preview URLs and environments. Correlate Git SHA and PR identifier where available, not just branch names.

Track migration files and applied-migration history separately. Mark unknown when the target database cannot safely be queried. Never execute application migration SQL from an observation agent.

## Automation and MCP

Initial scheduled worker only observes and records. Upcoming MCP methods: listProjects, getProjectContext, listAttention, captureIdea. Read methods first; writes use scoped auth, audit trail and explicit user approval. Destructive operations are out of scope in the first phases.

## Security

Production requires dashboard authentication even though this alpha is intended for trusted single-user use. Credentials remain server-side. Provider connectors have read scopes. Limit API usage and store no repository source files or secrets. Do not feed arbitrary files or instructions to an LLM. Add deployment secrets handling, per-user credentials and RBAC before a multi-tenant release.
