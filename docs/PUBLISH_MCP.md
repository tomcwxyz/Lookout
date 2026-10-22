# Publishing the standalone Lookout MCP bridge

_Updated 21 October 2026._

`packages/lookout-mcp` packages a standalone stdio bridge to the scoped Lookout HTTP API. It has no `@lookout/db` runtime dependency.

**Current public release:** `@good-ship/lookout-mcp@0.2.0`. The package is published to npm, and the merged CI workflow tests installation from the public registry and runs the clean-install smoke test. Trusted publishing is configured for the `tomcwxyz/Lookout` repository and `.github/workflows/publish-lookout-mcp.yml`.

Use it with private `LOOKOUT_API_URL` and `LOOKOUT_API_TOKEN` credentials. The live dashboard can generate ready-to-copy commands for Codex and Claude Code.

## Future releases

1. Update the version in `packages/lookout-mcp/package.json` and any version-pinned UI/docs.
2. Run `npm run typecheck`, `npm test` and `npm run build`; check the package syntax, smoke test and `npm pack --workspace @good-ship/lookout-mcp --dry-run`.
3. Merge the tested change to `main`.
4. Push the tag `lookout-mcp-v<version>` on the intended main commit. The trusted-publishing GitHub Actions workflow verifies the tag/version match and publishes with OIDC.
5. Verify `npm view @good-ship/lookout-mcp@<version> version` and launch a clean public-registry installation.

npm versions are immutable; do not use long-lived npm automation tokens when OIDC works. Never commit connection tokens or expose them in PR descriptions/logs.

**Operational acceptance remains:** connect real clients, call `lookout_get_handover`, submit and read back a checkpoint, revoke a token and verify cross-project isolation. The existence of a published package and passing smoke test does not prove real assistant integration.

## Pending 0.3.0 release

0.3.0 adds `lookout_submit_contribution`, `lookout_get_contributions` and the `lookout-report` CLI. Do not change the dashboard's pinned 0.2.0 command until the npm release and clean-install smoke test pass. Apply Lookout migration 0008 before deployment and verify real scoped-token reporting, read-back, revocation and cross-project denial.
