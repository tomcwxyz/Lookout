# Lookout MCP — local stdio alpha

A local MCP server exposes portfolio context without giving coding agents direct provider credentials. The MCP process connects to the same DATABASE_URL used by the Lookout worker.

Run from the repository root using: npx tsx apps/mcp/src/index.ts

Register that command as a stdio MCP server in a compatible coding agent. Working directory must be the Lookout repository, with the DATABASE_URL environment variable configured.

Tools:
- list_projects (read-only)
- list_attention (read-only)
- get_project_context (read-only, numeric projectId)
- capture_idea (local database write, disabled by default)

To enable the fourth tool, explicitly set LOOKOUT_MCP_WRITE_ENABLED=true for the MCP process. This does not grant GitHub, database migration or deployment permissions. The host running this process must be trusted because access to its local environment and database credential is sensitive.

In this alpha, the MCP server is **local stdio only**. A remotely hosted MCP endpoint will require per-user authentication, least privilege, audit logs and a proper permissions model before it is enabled.
