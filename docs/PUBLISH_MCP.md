# Publishing Lookout MCP

The package is a standalone workspace at `packages/lookout-mcp`, with no
`@lookout/db` dependency. CI checks JavaScript syntax, starts the MCP server
with dummy credentials and inspects the npm package contents.

**First release (completed by the npm scope owner):**

The owner reports `@good-ship/lookout-mcp@0.2.0` has been published and the
GitHub Actions trusted publisher has been configured for `tomcwxyz/Lookout`
and workflow `publish-lookout-mcp.yml`. Confirm registry visibility in CI.

**Future releases:** Update the package version and the Lookout UI's referenced
version, merge to main, then push tag `lookout-mcp-v<version>` on that exact
commit. npm versions cannot be republished.

Never commit a Lookout agent token or npm credentials. Do not create an npm
automation token: GitHub Actions uses short-lived OIDC credentials.

**Verification:** Install from the public registry on a clean machine using
`npx -y @good-ship/lookout-mcp@0.2.0` with project-scoped credentials, then
connect from Codex/Claude Code and call `lookout_get_handover`. Confirm
that a revoked token is rejected and that one project's token cannot read
another project. Only then merge PR #12 to enable the live one-command onboarding UI.
