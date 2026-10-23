# Lookout MCP bridge

Standalone MCP bridge for [Lookout](https://github.com/tomcwxyz/Lookout).
It uses a project-scoped token; **no database password** or repository checkout required.

Run using `npx -y @good-ship/lookout-mcp@0.3.0` after publishing the package.

Set `LOOKOUT_API_URL` and `LOOKOUT_API_TOKEN` privately in your MCP client configuration. The tools read the project's handover, human decisions and next actions and submit agent-reported checkpoints. They cannot confirm completion.

For release instructions, see `docs/PUBLISH_MCP.md` in the Lookout repository.

## Contributing project intelligence

Version 0.3.0 adds `lookout_submit_contribution` and `lookout_get_contributions` for repository-scoped coding agents. Reports are categorised as `progress`, `evidence`, `blocker`, `handover` or `next_action`. They are appended to the linked logical portfolio project, remain explicitly **unverified**, and cannot update human-confirmed status. Owner/ChatGPT OAuth remains read-only.

The same token can report from a CLI:

```bash
# Keep the credential in a private environment variable, not in the command.
export LOOKOUT_API_URL=https://lookout-eosin.vercel.app
export LOOKOUT_API_TOKEN=your-project-scoped-token
npx -y -p @good-ship/lookout-mcp@0.3.0 lookout-report ./checkpoint.json --kind handover
```

A checkpoint is version 1 with `eventId`, `agent`, `title`, `objective`, `summary`, `implemented`, `remaining`, `tests`, `decisions`, `blockers`, and optional `branch`, `commitSha`, `prUrl`, `capturedAt`. Use a stable unique event ID per meaningful report. Retry with the same content is safe; changing content under the same ID returns HTTP 409. Max 100 new contributions per token per rolling day. Do not include credentials or raw conversation transcripts.

New logical projects without an observed repository cannot yet issue a coding-agent token. The bridge requires an existing repository-scoped token created from the repository detail page.
