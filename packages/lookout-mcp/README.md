# Lookout MCP bridge

Standalone MCP bridge for [Lookout](https://github.com/tomcwxyz/Lookout).
It uses a project-scoped token; **no database password** or repository checkout required.

Run using `npx -y @good-ship/lookout-mcp@0.2.0` after publishing the package.

Set `LOOKOUT_API_URL` and `LOOKOUT_API_TOKEN` privately in your MCP client configuration. The tools read the project's handover, human decisions and next actions and submit agent-reported checkpoints. They cannot confirm completion.

For release instructions, see `docs/PUBLISH_MCP.md` in the Lookout repository.
