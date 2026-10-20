import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { databaseConfigured, getPortfolio, getProject, saveIdea } from "@lookout/db";

if (!databaseConfigured()) throw new Error("Lookout MCP requires DATABASE_URL");

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function createServer() {
  const server = new McpServer({ name: "lookout", version: "0.1.0" });

  server.registerTool("list_projects", {
    description: "List observed software projects, their last observation and rule-based summary.",
    inputSchema: z.object({})
  }, async () => {
    const data = await getPortfolio();
    return result(data.projects.map(p => ({
      id: p.id, name: p.name, slug: p.slug, url: p.url,
      summary: p.ruleSummary, observedAt: p.observedAt,
      aiBrief: p.aiBrief
    })));
  });

  server.registerTool("list_attention", {
    description: "List currently open evidence-backed attention items across all projects.",
    inputSchema: z.object({})
  }, async () => {
    const data = await getPortfolio();
    return result(data.attention);
  });

  server.registerTool("get_project_context", {
    description: "Retrieve a project's observed Git branches, PRs, latest CI result, ideas and open findings. Missing sources are unknown, never assumed healthy.",
    inputSchema: z.object({ projectId: z.number().int().positive() })
  }, async ({ projectId }) => {
    const data = await getProject(projectId);
    if (!data.project) return { isError: true, content: [{ type: "text", text: "Project not found" }] };
    return result({
      project: data.project.name, slug: data.project.slug,
      observedAt: data.project.observedAt, ruleSummary: data.project.ruleSummary,
      aiBrief: data.project.aiBrief, snapshot: data.project.snapshot,
      attention: data.findings, ideas: data.ideas
    });
  });

  server.registerTool("capture_idea", {
    description: "Capture a low-risk idea or note without creating a GitHub issue. Requires explicit LOOKOUT_MCP_WRITE_ENABLED=true.",
    inputSchema: z.object({
      projectId: z.number().int().positive().optional(),
      title: z.string().min(1).max(240),
      note: z.string().max(5000).optional()
    })
  }, async ({ projectId, title, note }) => {
    if (process.env.LOOKOUT_MCP_WRITE_ENABLED !== "true") {
      return { isError: true, content: [{ type: "text", text: "Idea capture is disabled; set LOOKOUT_MCP_WRITE_ENABLED=true for this local MCP process." }] };
    }
    const [idea] = await saveIdea({ projectId, title, note });
    return result({ id: idea.id, title: idea.title, status: idea.status });
  });

  return server;
}

// stdio transports must never write logs to stdout.
try {
  serveStdio(createServer);
} catch (error) {
  console.error("Lookout MCP failed:", error);
  process.exitCode = 1;
}
