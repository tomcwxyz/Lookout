# Lookout agent handovers

_Implemented in main on 21 October 2026; real cross-agent acceptance testing remains._

## Purpose

GitHub PRs, merges, CI and deployments give independent observations. A coding agent also knows intent and intermediate work that has not reached Git. Lookout keeps those **agent-reported claims** alongside observed evidence and human-confirmed decisions without treating them as interchangeable.

The portable checkpoint model draws on [TOPO](https://github.com/tomcwxyz/TOPO), but Lookout does **not** automatically connect to or ingest TOPO's private memory, and its local service must not be exposed to the web.

## Default: plain-English session notes

**Agent contributions are for context that GitHub and infrastructure observations cannot explain.** Do not repeat commit lists, filenames, CI logs, route names, package upgrades or deployment metadata in prose. Lookout already records technical evidence separately.

At the end of a meaningful working session, write a short note that answers:

1. **Aim:** What were we trying to achieve, and why?
2. **Done:** What is meaningfully different for users or maintainers?
3. **Not done:** What remains unfinished, unverified or deliberately deferred?
4. **Decided:** What choices were made, including constraints to preserve?
5. **Next:** What is the most useful place to resume?

Use everyday British English, concrete outcomes and short sentences. Distinguish implemented from tested, merged, deployed and user-accepted. Never claim an outcome merely because code was written or an agent intended to do it. If there is nothing useful to report, do not submit filler.

### Example session note (current version-1 contract)

The existing MCP uses a technical checkpoint envelope. Until the API accepts a dedicated session-note schema, map meaningful session context into its existing fields:

- `title`: a short outcome-oriented session heading
- `objective`: what we were trying to achieve and why
- `summary`: a plain-English account of the session, mentioning important limitations
- `implemented`: meaningful things completed, not a list of files or commands
- `remaining`: unfinished work, unverified outcomes and the next useful step
- `decisions`: choices and constraints to carry forward
- `blockers`: genuine reasons progress cannot continue, not routine pending work
- `tests`: optional verification claims, not a technical checklist; only record relevant checks
- `branch`, `commitSha`, `prUrl`: optional technical links, not the substance of the note

```json
{
  "version": 1,
  "eventId": "mossline-session-2026-10-23-labelling",
  "agent": "ChatGPT",
  "title": "Improved how large network maps read",
  "objective": "Make larger networks clearer and more usable, especially on mobile.",
  "summary": "We improved the presentation of connections and made navigation more reliable. Some visual refinement remains, and we have not yet confirmed the experience across a wide range of real datasets.",
  "implemented": ["Improved connection clarity", "Made navigation of large networks more reliable"],
  "remaining": ["Improve labels and distinctions between types of node", "Test with different large real-world datasets"],
  "tests": [],
  "decisions": ["Retain support for large networks on mobile", "Keep changes separate from other active branch work"],
  "blockers": []
}
```

This is an **illustrative sample**, not a claim that those changes have been verified or submitted.

### Proposed next contract (not yet implemented)

Introduce a first-class `session_note` contribution with `aim`, `done`, `notDone`, `decisions`, `next`, and optional `evidenceUrls`. Preserve legacy version-1 checkpoints for existing agents. Present session notes first in the project timeline and handover, with technical evidence in a secondary expandable section. Separate **agent-reported**, **source-verified** and **human-confirmed** provenance. Do not infer acceptance from a submitted note.

### When to write a note

Submit one meaningful note at a natural session handover, after substantial changes or when passing work to another agent. Do not report on every tool call or invent unfinished work. The agent should first identify which work was actually done and what can be independently verified. This is guidance rather than an automatic end-of-session hook; automatic capture depends on the host agent supporting lifecycle events.

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
