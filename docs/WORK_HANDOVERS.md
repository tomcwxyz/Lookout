# Lookout work handovers

_Updated 21 October 2026._

The goal is to answer: **what were we doing, what has actually changed, what remains and which decision is needed?**

## Current implementation

The GitHub observer samples:
- Open PR purpose, author checklists, bounded review status, CI checks and recent discussion;
- Recently merged PRs (up to six per repository);
- Open issues and explicit testing/review labels;
- Up to two conventional Markdown plans (`ROADMAP`, `PLAN`, `STATUS`, `TODO`, `BACKLOG`) in the repository root or `docs/`, including bounded checkbox lines.

The overview presents a prioritised **Work to pick up** queue, and project pages provide linked work evidence, inferred status and a suggested next action. Check-run failures, changes requested, testing outstanding, review requests, draft/in-progress work, possible pauses, merged-but-unverified changes, older plans and automated maintenance are distinguished. Unavailable evidence is marked unknown, not successful.

A PR assertion such as "tests passed" is a **claim**, not independent CI evidence. Merged is not the same as deployed or accepted; an old unchecked plan is not proof a feature remains unbuilt.

## Human progress decisions

For an individual source work item, **Confirm progress** offers **Complete / accepted**, **Implemented · tidy-up remains**, **Needs human testing**, **Needs human review**, **Actively in progress**, **On hold**, and **Scoped, not built**, plus an optional next-step note.

These decisions persist in Lookout's own `work_decisions` table (migration `0004_work_decisions.sql`) and override inferred status without rewriting the underlying evidence. If a signal falls out of the bounded sampling window, its decision remains stored but may not display until that work key reappears.

## Related agent history

Each project's activity timeline can also display **agent-reported** checkpoints, **GitHub-observed** merges and **human-confirmed** statuses as distinct sources. See [AGENT_HANDOVERS](AGENT_HANDOVERS.md). Connecting assistants and verifying actual cross-agent recovery remains an acceptance step, not a demonstrated production outcome.

## Limits / next iteration

The current unit of observation is a repository or individual PR/issue/plan item, not a durable feature spanning multiple PRs and repos. PR details, discussions, issues and plan files are sampled; documentation or user conversations outside GitHub are not currently ingested. The system does not yet discover the authoritative current plan, reconcile stale tasks against newer code, verify deployments or migrations for every work item, or automatically close work as accepted.

Next: stable feature groups, explicit evidence grading and clearer coverage; human reviews of ambiguous state; change-driven history and lower-noise attention policies. See [ROADMAP](ROADMAP.md).
