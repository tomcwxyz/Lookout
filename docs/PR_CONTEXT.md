# PR-backed project handovers (Lookout Alpha)

Lookout now examines more than PR titles. It uses bounded, read-only GitHub API observations to pull:
- PR purpose and sections of the author's Markdown description
- Completed and outstanding PR checklist items
- Testing statements, follow-up tasks, risks, and recent issue comments
- Review decisions and requested-reviewer counts for up to five recently updated open PRs per repository
- Commit check-run outcomes for those PRs when the GitHub token allows access
- Descriptions of recent merged PRs

The overview highlights the purpose and next task rather than simply labelling everything "Human review". Per-project pages provide source-linked expandable evidence.

## Interpretation

A PR body can **claim** a test passed or a feature shipped; this is labelled as PR-authored evidence, not an independently verified claim. An unchecked checklist is outstanding in the PR description but can be stale. An approval means at least one reviewer approved; it is not proof all merge gates passed. If check or review access is denied, status is **unknown**, never green. GitHub bot-authored maintenance PRs remain visible on project pages but are deprioritised in the main work queue.

Lookout distinguishes:
- Checks failing
- Changes requested by reviewer
- Explicit testing checklist remains
- Requested review outstanding
- Approved (verify actual merge readiness)
- Open draft/in progress
- Possibly paused (21+ days without PR update)
- Open, no explicit next decision found
- Bot-maintained dependency updates
- Recently merged but acceptance/deployment unverified

A user's manually confirmed state still takes precedence over automated interpretations and remains persisted.

## Limits

The observer samples five open PRs per repository for detailed review/comments/check metadata, up to 12 open PR descriptions, and up to six recent merged PR descriptions. It collects at most three recent discussion comments per sampled PR, not full review threads or code diffs. No files or secrets are scanned or sent to a generative model by this feature. AI narrative remains optional and separate. This avoids unbounded API usage but means an older PR can have an unknown check state.

Future improvements: linked issue/PR feature grouping, branch deployment confirmation, follow-up progress tracking, latest authoritative plan identification across providers, full code review thread context, and optional structured AI summaries with grounded citations.
