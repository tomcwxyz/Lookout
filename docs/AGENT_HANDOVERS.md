# Lookout agent handovers

_Implemented in main on 21 October 2026; real cross-agent acceptance testing remains._

## Purpose

GitHub PRs, merges, CI and deployments give independent observations. A coding agent also knows intent and intermediate work that has not reached Git. Lookout keeps those **agent-reported claims** alongside observed evidence and human-confirmed decisions without treating them as interchangeable.

The portable checkpoint model draws on [TOPO](https://github.com/tomcwxyz/TOPO), but Lookout does **not** automatically connect to or ingest TOPO's private memory, and its local service must not be exposed to the web.

## Connect an agent

1. Open [Lookout](https://lookout-eosin.vercel.app) and select the relevant observed project.
2. Select **Connect your coding assistant**, choose Codex, Claude Code or **Other MCP assistant**, then prepare a connection.
3. Use the one-time-shown setup command or values in the client. They contain a **private project-scoped token**. Keep it out of Git, logs and shared chat transcripts.
4. For other clients: configure `LOOKOUT_API_URL=https://lookout-eosin.vercel.app`, the issued `LOOKOUT_API_TOKEN`, and execute `npx -y @good-ship/lookout-mcp@0.2.0` as a local stdio MCP process.
5. In the client, call `lookout_get_handover` to verify access. A configured connection alone is not evidence of a working session.

No Lookout repository clone, npm workspace installation, database password or provider credentials are needed in this remote bridge mode. To revoke a connection return to **Manage connections** on the project.

## Remote tools

- `lookout_get_handover` — bounded Git/PR context, recent agent checkpoints and authoritative human decisions.
- `lookout_get_decisions` — only decisions confirmed by a human.
- `lookout_get_next_actions` — bounded proposed next tasks from PRs and agent checkpoints.
- `lookout_propose_checkpoint` — proposal-only, append-only, idempotent checkpoint with an `eventId`.

Token identity determines the project; the bearer cannot request an unrelated project's data. An agent's implementation or test claim does not override human-confirmed work status.

## Example checkpoint

```json
{
  "version": 1,
  "eventId": "codex-session-123:handover-01",
  "agent": "Codex",
  "title": "Improved page reading",
  "objective": "Recover low-confidence OCR words in Buddy",
  "summary": "Context-aware OCR correction implemented; real-page testing remains.",
  "branch": "feat/ocr-context",
  "commitSha": "ab12345",
  "implemented": ["Added sentence-aware suggestion handling"],
  "remaining": ["Test with a dimly lit printed page"],
  "tests": [
    {"description": "Unit tests", "result": "passed_claimed"},
    {"description": "Human reading test", "result": "needs_human"}
  ],
  "decisions": ["Preserve manually corrected words"],
  "blockers": []
}
```

The contract is versioned and size-bounded. Repeating the same event and payload is safe; changing payload for an existing event ID is rejected with HTTP 409. No automatic verification of agent test claims occurs.

## API and security

- `GET /api/agent/handover`: project-scoped bearer token.
- `GET /api/agent/checkpoints`: bearer token.
- `POST /api/agent/checkpoints`: bearer token; checkpoint JSON or `{"checkpoint": ...}`.
- `GET/POST/DELETE /api/agent/tokens`: same-origin, dashboard-authenticated management, **not** accessible to an agent token.

Tokens are hashed at rest, issued for one project, revocable and revealed once. No raw transcripts, provider secrets or private TOPO pages are requested or stored as part of checkpoint submission.

## Acceptance not yet complete

- [ ] Connect two real coding-agent clients with appropriately scoped tokens.
- [ ] Submit an agent checkpoint, then recover its context from the other agent.
- [ ] Check retry idempotency, conflicting event ID behaviour and token revocation.
- [ ] Prove a token cannot access a second project and verify human decisions remain authoritative.
- [ ] Observe real, source-linked checkpoint history in the dashboard.

Future work: optional local lifecycle hooks, offline batching, source-linked CI/deployment verification, stable feature grouping and permission-controlled TOPO context exchange.
