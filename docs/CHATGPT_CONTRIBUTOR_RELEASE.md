# ChatGPT contributor OAuth release

This is an opt-in permission for the owner ChatGPT connection, not a repository or deployment write grant.

## Database
Run additive `packages/db/migrations/0009_chatgpt_contributions.sql` on a disposable Neon branch, verify, then obtain approval before applying to production. Do not deploy the writable MCP before its schema exists.

## Connection
Reconnect the existing Lookout custom MCP in ChatGPT after the new deployment. Grant `lookout:contribute` on the consent screen. Older read-only sessions remain read-only until reauthorised. Owner Bearer tokens intentionally remain read-only.

## Test
1. Confirm `lookout_whoami` and `lookout_list_projects` work.
2. Select a real logical portfolio ID from `lookout_list_projects`.
3. Ask ChatGPT to submit a synthetic `progress` report through `lookout_submit_chatgpt_contribution`. Require confirmation before submitting. Use a unique eventId and explicitly mark tests as not_run.
4. Call `lookout_list_chatgpt_contributions` on that portfolio ID and verify attribution, timestamp and details.
5. Connect a repository-scoped Codex/Claude agent; its `lookout_get_handover` should expose relevant ChatGPT reports.
6. Retry exactly the same eventId/body (one stored row), change the body under the same eventId (rejected).
7. Try an invalid portfolio ID (rejected).
8. Reconnect without `lookout:contribute` and confirm the write tool is unavailable.
9. Verify dashboard human-confirmed statuses, repository code, migrations and deployments do not change.
10. Revoke OAuth sessions from Lookout's Web chat connection page and verify access is lost.

## Boundaries
ChatGPT contributions are append-only, rate-limited to 100 new reports per OAuth client per rolling day, and never override observed GitHub CI or human decisions. The hosted MCP uses a separate token-attributed table to avoid impersonating repository-agent tokens. No raw transcripts, passwords or credentials should be submitted.
