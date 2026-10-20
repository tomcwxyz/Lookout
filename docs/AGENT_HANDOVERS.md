# Lookout agent handovers — first interoperable release

## Why

Git, PRs, CI and deployment records are observable evidence. AI coding sessions also contain intent, implementation claims, design decisions and unfinished tasks that may never reach a PR. Lookout links **agent-reported** checkpoints to observed technical evidence while keeping user decisions authoritative.

This uses ideas from [TOPO](https://github.com/tomcwxyz/TOPO) (portable context, provenance, proposal-first machine writes), but does **not** connect to or ingest TOPO memory by default. TOPO's local context resolver should remain governed; its loopback bearer service must not be exposed to Vercel.

## Setup

1. Open Lookout and select an observed project.
2. Open **Connect a coding agent**. Create a **project-scoped** connection labelled for that agent/client.
3. Copy the 256-bit token (shown only once). You can revoke it from the same screen.
4. On the agent's machine, check out Lookout's open-source repository, install dependencies, and run the local MCP bridge:

\`\`\`bash
npm install
LOOKOUT_API_URL=https://lookout-eosin.vercel.app \
LOOKOUT_API_TOKEN='your-private-project-token' \
npx tsx apps/mcp/src/index.ts
\`\`\`

Register this command (with the two variables stored privately) in your coding assistant's MCP configuration. For Windows Git Bash the same inline environment syntax works. **Do not commit tokens to any repo or paste them into PRs.**

No Neon connection string is required when using the remote MCP mode. The local DATABASE_URL mode and existing read-only MCP tools remain available separately.

## MCP tools

- \`lookout_get_handover\` — bounded observed PR state, recent proposed agent checkpoints and user-confirmed decisions for the token's project
- \`lookout_get_decisions\` — explicit decisions saved by a person, not agent guesses
- \`lookout_get_next_actions\` — bounded next actions from recent agent checkpoints and open PRs
- \`lookout_propose_checkpoint\` — submit a portable checkpoint; idempotent on \`eventId\`

The service rejects other project IDs by construction. Token identity determines the project; clients do not choose a project ID in the HTTP request.

## Example checkpoint

\`\`\`json
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
    {"description":"Unit tests","result":"passed_claimed"},
    {"description":"Human reading test","result":"needs_human"}
  ],
  "decisions": ["Preserve manually corrected words"],
  "blockers": []
}
\`\`\`

The full payload is bounded and rejects raw transcripts, arbitrary fields, huge text or unknown versions. The API never independently verifies a claimed test outcome. Each event is *proposed/agent-reported*, can be retried idempotently, and remains in the history after further scans. Submitting the same event ID with changed content yields HTTP 409.

A second agent can call \`lookout_get_handover\` and continue from the earlier checkpoint. Agent status never supersedes human-confirmed work status.

## HTTP

- \`GET /api/agent/handover\` — bearer token
- \`GET /api/agent/checkpoints\` — bearer token
- \`POST /api/agent/checkpoints\` — bearer token; checkpoint JSON or \`{"checkpoint":...}\`
- \`GET/POST/DELETE /api/agent/tokens\` — dashboard Basic Auth (same-origin POST/DELETE), not callable with an agent token

No raw chats, private TOPO pages or secrets are requested. All model-supplied content is untrusted input and displayed as a claim with its agent source. Token revocation is immediate; use separate tokens per client.

## Next

The first release is a scoped, explicit MCP bridge, not an automatic end-of-session hook. Later add user-authorised local agent lifecycle adapters, offline batching, verification links from checkpoint SHA to CI/deployments, feature grouping and TOPO context exchange through TOPO's own permissions and source-boundary rules. Avoid remote TOPO loopback bridging or implicit personal-memory uploads.
