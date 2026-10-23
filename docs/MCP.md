# Lookout MCP interfaces

_Updated 21 October 2026. There are **two different MCP modes**._

## 1. Hosted Lookout handovers (recommended for coding assistants)

A standalone local stdio bridge communicates with Lookout's scoped HTTP API. It needs **neither a checkout of this repository nor DATABASE_URL**.

1. Open [Lookout](https://lookout-eosin.vercel.app) and select a project.
2. Choose **Connect your coding assistant** and prepare a Codex, Claude Code or other MCP connection.
3. Copy the generated setup command, which includes a **one-time-shown project-scoped token**. Keep it private.
4. Launch the client and ask for the project's handover to test the connection.

For generic stdio clients configure private environment variables:

```text
LOOKOUT_API_URL=https://lookout-eosin.vercel.app
LOOKOUT_API_TOKEN=<private project-scoped token>
```

Use command `npx` with arguments `-y @good-ship/lookout-mcp@0.2.0`. Avoid writing tokens into public repository files, screenshots, CI logs or shell history.

**Writing guidance:** the contribution should be a short, plain-English session note explaining the aim, what was done, what remains, decisions and the next useful step. Do not re-list technical evidence already captured by GitHub, CI or deployments. The current MCP payload still uses version-1 checkpoint fields; see [AGENT_HANDOVERS](AGENT_HANDOVERS.md) for their session-note mapping. A dedicated session-note API is proposed but not yet implemented.

Remote handover tools:
- `lookout_record_session`: preferred plain-English end-of-session note (aim, done, not done, decisions, next), written as an agent-reported claim and stored compatibly in the existing checkpoint API. Available in the local stdio bridge after the next package release; not yet exposed by the hosted ChatGPT MCP.
- `lookout_get_handover`: bounded recent project context and proposed agent checkpoints.
- `lookout_get_decisions`: human-confirmed decisions.
- `lookout_get_next_actions`: next actions from available evidence.
- `lookout_propose_checkpoint`: explicitly submit an idempotent, agent-reported progress event.

A connected client is not proof that an agent is actively reporting; the first real handshake, a proposed checkpoint, a second client's recovery and token revocation still require acceptance testing.

## 2. Local database-backed portfolio MCP

For local/developer use in a trusted Lookout checkout:

```bash
npm install
# Configure DATABASE_URL privately in the server environment
npm run mcp
```

The implementation is `apps/mcp/src/index.ts`. It accesses the same Lookout database as the worker and offers:
- `list_projects`
- `list_attention`
- `get_project_context` (numeric project ID)
- `list_infrastructure`
- `get_project_infrastructure`
- `capture_idea` (opt in with `LOOKOUT_MCP_WRITE_ENABLED=true`)

Do not expose the local MCP process or its database connection to the public internet. Its optional `capture_idea` writes to **Lookout's own** database, not provider repositories/databases.

See [AGENT_HANDOVERS](AGENT_HANDOVERS.md) for checkpoint semantics and [PUBLISH_MCP](PUBLISH_MCP.md) for npm release instructions.

## 3. Hosted read-only HTTP MCP (personal pilot)

For browser-based and remote MCP clients, the HTTPS endpoint `/api/mcp` provides a private read-only portfolio interface. It uses a separate `LOOKOUT_MCP_OWNER_TOKEN` (set on Vercel) or an existing project-scoped agent token. See [HOSTED_MCP](HOSTED_MCP.md) for setup, security and plan limitations. This is not an OAuth connection yet.
