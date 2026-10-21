# Publishing Lookout MCP

The package is a standalone workspace at `packages/lookout-mcp`, with no
`@lookout/db` dependency. CI checks JavaScript syntax, starts the MCP server
with dummy credentials and inspects the npm package contents.

**One-time first release (requires the npm scope owner):**

1. Confirm ownership of the npm `@goodship` scope, or change the package name
   and the Lookout connection command before publishing.
2. After merging the PR, run `npm login` on a trusted computer with 2FA enabled.
3. Run `npm publish --workspace @goodship/lookout-mcp --access public` from
   the repository root. npm trusted publishing cannot bootstrap a package
   that does not yet exist.
4. In the npm package settings, add a GitHub Actions trusted publisher:
   owner `tomcwxyz`, repository `Lookout`, workflow
   `publish-lookout-mcp.yml`, and enable **npm publish**.
5. For future versions, update the package version and the Lookout UI's
   referenced version, merge to main, then push tag
   `lookout-mcp-v<version>` on that exact commit.

Never commit a Lookout agent token or npm credentials. Do not create an npm
automation token: GitHub Actions uses short-lived OIDC credentials.

**Verification:** Install from the public registry on a clean machine using
`npx -y @goodship/lookout-mcp@0.2.0` with project-scoped credentials, then
connect from Codex/Claude Code and call `lookout_get_handover`. Confirm
that a revoked token is rejected and that one project's token cannot read
another project. Only then enable the live one-command onboarding UI.
