# Lookout project work handovers (initial release)

Lookout should answer **where did I leave this, what's finished, and what decision is needed next?** Git metadata is evidence but not the full story of delivery.

## Observations and evidence

The GitHub observer now samples:
- Open draft and review-ready pull requests
- Recent merged PRs (up to 6 per repository)
- Open issues and explicit QA/review labels (up to 30)
- Up to two Markdown plan files named ROADMAP, PLAN, STATUS, TODO or BACKLOG, at root or in docs/, and their first 20 checkbox tasks

Signals always link to the original PR, issue, or roadmap line. Sampled plans are **not** guaranteed to be the most recent or only plans. The first pass does not read issues' complete descriptions or files outside the sampled directories.

## What statuses mean

- **Human review / Testing needed**: an open, review-ready PR or issue explicitly labelled for testing or review. This signals work needing a decision, not proof that QA was carried out.
- **In progress / Possibly paused**: an open draft or old, unmerged PR. Staleness never means the work should be deleted.
- **Merged · verify**: a PR reached the repository. It does not prove production deployment, acceptance, testing, or tidy-up.
- **Planned · unverified**: unchecked roadmap item or open issue. It may already have been partly or completely built.
- **Marked complete in plan**: a checked box, not independent evidence of acceptance.

## Human confirmations

Each identified item has a **Confirm progress** action with a status and optional follow-up note. Possible outcomes include **Complete / accepted**, **Implemented · tidy-up remains**, **Needs human testing**, **Needs human review**, **Actively in progress**, **On hold**, and **Scoped, not built**.

Confirmed statuses are saved in Lookout's work_decisions table and are never overwritten by provider scans. You can revert to an evidence suggestion. A confirmation applies to its stable PR, issue or plan-line key. If source items move out of the bounded recent-activity sample, the old confirmation remains stored but won't be displayed until that source key reappears.

The overview prioritises work needing attention. Each project's work handover shows evidence, the inferred status, and any explicit human confirmation. Technical branch and infrastructure detail remains available underneath.

## Limitations and next iterations

The initial work model is **evidence-linked, not a comprehensive project-management database**. It does not yet group all commits and PRs into larger features, establish release or user acceptance automatically, ingest external Docs/Drive/Notion/meeting notes, reconcile stale roadmap tasks with implementation, or infer work content through LLMs. A robust next iteration should identify the latest authoritative documents, group changes into themes, recognise test evidence, and prompt a human to resolve contradictions.

The additive database migration is `0004_work_decisions.sql`. Apply it only to Lookout's own database, not databases being observed.
