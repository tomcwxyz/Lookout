# Publishing Lookout MCP

The package is a standalone workspace at `packages/lookout-mcp`, with no
`@lookout/db` dependency. CI checks JavaScript syntax, starts the MCP server
with dummy credentials and inspects the npm package contents.

**One-time first release (requires the npm scope owner):**

1. The npm `@good-ship` scope is owned by the `tomcwxyz` npm account. Confirm
   you are logged into that account using `npm whoami`.
2. From the `feat/simple-agent-onboarding` branch, run `npm login` on a trusted computer with 2FA enabled.
3. Run `npm publish --workspace @good-ship/lookout-mcp --access public` from
   the repository root. Publish the initial package before merging the PR so the generated setup
   command is already usable when the UI goes live.
4. In the npm package settings, add a GitHub Actions trusted publisher:
   owner `tomcwxyz`, repository `Lookout`, workflow
   `publish-lookout-mcp.yml`, and ensure the GitHub Actions workflow is authorised to publish.
5. For future versions, update the package version and the Lookout UI's
   referenced version, merge to main, then push tag
   `lookout-mcp-v<version>` on that exact commit.

Never commit a Lookout agent token or npm credentials. Do not create an npm
automation token: GitHub Actions uses short-lived OIDC credentials.

**Verification:** Install from the public registry on a clean machine using
`npx -y @good-ship/lookout-mcp@0.2.0` with project-scoped credentials, then
connect from Codex/Claude Code and call `lookout_get_handover`. Confirm
that a revoked token is rejected and that one project's token cannot read
another project. Only then merge PR #12 to enable the live one-command onboarding UI.
