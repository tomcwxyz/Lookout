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

## Revision-aware handovers (new in the 0.4 release)

Once 0.4 is published and the Lookout server has applied migration 0014:

1. Call `lookout_get_context` **before meaningful work**. It includes earlier ChatGPT
   and coding-agent notes, verified observation timestamps, explicit human decisions,
   current workstreams and a numeric `revision` and `legacyCursor`.
2. Work and check your own evidence.
3. Call `lookout_submit_handover` with `basedOnRevision` from that response,
   `basedOnLegacyCursor` from the same context, a stable `eventId`, a plain-English account of the result and `next`.
   Optional `addresses` points at earlier handover event IDs. These are
   **proposed closures**, not automatic resolutions.
4. Inspect the returned receipt or use `lookout_get_reconciliation`.
   An agent writing against an old revision is recorded under
   `needs_review` and does not replace the incorporated position.

The new tools do not replace the older v1 session and checkpoint endpoints.
They provide a safer path to shared memory. If you did not fetch context,
omit `basedOnRevision`; Lookout will retain the note but not promote it.
The project's current position remains an **attributed, unverified report**;
human acceptance can only be recorded by an authorised person.

The package `0.4.0` is prepared in this branch. Until it is published, use the
existing `0.3.0` package and its original tools; the new hosted MCP can be
used after the server deployment and migration.
