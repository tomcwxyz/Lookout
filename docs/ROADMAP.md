# Lookout roadmap

_Reviewed 21 October 2026. Shipped means code is merged and the production deployment is READY; it does not mean every feature has been user-accepted._

## Shipped foundation (alpha 0.1–0.3, in main)

- [x] Typed monorepo with Next.js dashboard, Postgres/Drizzle state, deterministic attention rules and tests.
- [x] Read-only GitHub repository, branch, issue, PR and Actions observation, with source-linked findings.
- [x] Read-only Neon project/branch/compute and Vercel project/deployment inventory, with explicit resource association.
- [x] Authenticated **Scan all** and provider-specific scans, with concurrent scan leases.
- [x] Vercel cron observation for GitHub, Neon and Vercel every six hours, plus standalone worker option.
- [x] Evidence-backed work queue from recent merged/open PRs, review and CI context, issues and sampled Markdown plans.
- [x] Human-confirmed per-work-item progress and follow-up notes, preserved across scans.
- [x] Local MCP portfolio methods and optional AI-generated project briefs.
- [x] Scoped coding-agent tokens, bearer handover/checkpoint endpoints, idempotent agent-reported checkpoints and activity timeline.
- [x] Standalone npm MCP bridge `@good-ship/lookout-mcp@0.2.0`, assistant-specific setup and CI registry smoke test.
- [x] Production web deployment and Lookout schema migrations 0001–0005 on its own Neon database.

## Now: product validation and clearer work intelligence

- [ ] Complete real **two-agent** acceptance: connect client A, submit checkpoint, recover with client B, verify token isolation, revocation and idempotency.
- [ ] Show connection health / last successful checkpoint rather than treating a configured token as proof of an online agent.
- [ ] Group PRs, commits, branches, issues, checkpoints and plans into durable **features or pieces of work**, not separate disconnected signals.
- [ ] Distinguish implemented, tested, deployed, human-accepted and tidy-up remaining with cited evidence and uncertainty.
- [ ] Find the latest authoritative plan across supported sources and reconcile old checklists against newer implementation.
- [ ] Make the portfolio queue actionable: deduplicate repeated branch/PR alerts, rank blockers, configurable policies, snoozing and accepted risks.
- [ ] Expand GitHub pagination and repository coverage beyond the default 25 recently pushed repos; show coverage prominently.
- [ ] Add historical observation deltas and persistent change-oriented briefings beyond the current bounded per-project timeline.

## Next: safer and broader evidence

- [ ] Verify migration file inventory against read-only **applied migration history per environment**, treating missing access as unknown.
- [ ] Improve project identity graph across multiple Git repos, Vercel services and databases; reconcile verified PR/commit/deployment links.
- [ ] Record objective cost and activity evidence where provider permissions permit; avoid implied £0 or idle judgements.
- [ ] Add GitLab, Codeberg, Framagit and other provider adapters.
- [ ] Add user-authorised local agent session hooks and optional TOPO exchange, respecting provenance and separate permissions.
- [ ] Self-hosted deployment guide/Compose, multi-user accounts/RBAC and auditable permissioned actions.

## Known release boundaries

- The GitHub evidence observer samples branches/PRs/issues and at most two Markdown plans; old unchecked plans are **not** proof that features remain unbuilt.
- The remote MCP bridge currently has no automatic end-of-session capture; checkpoints are explicitly proposed, never accepted as fact.
- Human-confirmed progress exists, but a one-click automated release/cleanup workflow **does not**.
- No application migrations are run in observed databases. The five applied Lookout migrations cover Lookout's own schema only.
- Current dashboard authentication is single-user Basic Auth.

See [README](../README.md), [architecture](ARCHITECTURE.md), [work handovers](WORK_HANDOVERS.md) and [agent handovers](AGENT_HANDOVERS.md).
