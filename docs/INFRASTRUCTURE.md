# Infrastructure observer (Alpha 0.2)

Neon and Vercel support is optional. Both connectors use provider API tokens for GET requests only. Existing databases, branches and deployments are **never modified**.

## Setup

Provide DATABASE_URL as usual, apply the additive migration with npm run db:migrate, then set one or both:

- NEON_API_KEY: API key with access to the Neon projects to observe.
- NEON_ORG_ID: optional Neon organisation identifier; necessary if your personal key spans several organisations.
- LOOKOUT_NEON_MAX_PROJECTS: default 30.
- VERCEL_API_TOKEN: access token permitted to list projects and deployments.
- VERCEL_TEAM_ID: optional team ID. Without it the Vercel API accesses the personal scope.
- LOOKOUT_VERCEL_MAX_PROJECTS: default 30.
- LOOKOUT_DB_BRANCH_REVIEW_DAYS: default 30.

Run npm run sync and visit /infrastructure. The read-only worker can run independently.

## What is verified

- Neon projects, branches, parent IDs, branch creation metadata and compute endpoint counts/current state.
- Vercel projects, their GitHub repository identity when explicitly provided by Vercel, and latest deployment for each returned environment.
- Neon secondary branches older than the configured lifetime threshold get a *review* flag, not an assertion of inactivity or a bill.
- Latest deployments whose provider state is ERROR or BLOCKED get a failure flag.
- Vercel project-to-GitHub linking is based only on provider-supplied exact repository identifiers from project linkage or deployment Git metadata. Neon has no automatic name matching.

You can manually associate a Neon or Vercel resource with an observed GitHub repository on /infrastructure. Manual choices survive future syncs; choosing "Unlinked" opts the resource out of automatic linking. Existing child resources inherit manual parent links immediately; newly discovered children inherit during observation if they have no manual association.

## Important limitations

- No pricing, billing amounts or branch-level consumption claims yet. Endpoint counts and metadata are not billed usage.
- Branch updated_at is metadata, *not* reliable evidence of the last SQL query; lifecycle age is what the first rule evaluates.
- A partial provider failure is recorded as failed; previously collected observations remain available and are labelled by observation time.
- Project caps bound API work. A resource missing from a capped sync is NOT considered deleted.
- Vercel deployment history is sampled to the first 20 per project, and only the latest per target is retained. No blanket conclusions about all historical deployments.
- The two cloud accounts may contain multiple organisations/teams; configure the intended scope explicitly.
- Database migration verification requires a separate, explicitly scoped read-only database connection and migration-table adapter. Lookout does not infer that migrations have run by inspecting SQL files alone.
- Cloud tokens must never be exposed to the client, stored as raw observations or committed to Git.
