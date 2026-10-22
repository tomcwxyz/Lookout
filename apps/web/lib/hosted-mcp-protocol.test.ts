import { describe, expect, it, vi } from "vitest";
vi.mock("@lookout/db", () => ({
  authoriseAgentToken: vi.fn(async () => null),
  getPortfolio: vi.fn(async () => ({ projects: [], attention: [], workDecisions: [] })),
  getProject: vi.fn(async () => ({ project: null, findings: [], decisions: [] })),
  getAgentHandover: vi.fn(async () => null),
  getInfrastructurePortfolio: vi.fn(async () => ({ resources: [], findings: [] })),
  getLinkedResources: vi.fn(async () => [])
}));
import { POST } from "../app/api/mcp/route";
import type { NextRequest } from "next/server";

describe("hosted MCP handshake", () => {
  it("requires authorisation", async () => {
    const url = "https://lookout.example/api/mcp";
    const req = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    }) as NextRequest;
    Object.defineProperty(req, "nextUrl", { value: new URL(url) });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });
  it("initialises and lists tools for a private owner connection", async () => {
    const owner = "p".repeat(64);
    const prior = process.env.LOOKOUT_MCP_OWNER_TOKEN;
    process.env.LOOKOUT_MCP_OWNER_TOKEN = owner;
    try {
      async function send(method: string, params: unknown) {
        const url = "https://lookout.example/api/mcp";
        const req = new Request(url, {
          method: "POST",
          headers: { Authorization: "Bearer " + owner,
            "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
        }) as NextRequest;
        Object.defineProperty(req, "nextUrl", { value: new URL(url) });
        const response = await POST(req);
        const raw = await response.text();
        const dataLine = raw.split("\n").find(line => line.startsWith("data: "));
        const body = JSON.parse(dataLine ? dataLine.slice(6) : raw);
        return { status: response.status, body };
      }
      const init = await send("initialize", {
        protocolVersion: "2025-06-18", capabilities: {},
        clientInfo: { name: "test", version: "1" }
      });
      expect(init.status).toBe(200);
      expect(init.body.result?.serverInfo?.name).toBe("lookout");
      const tools = await send("tools/list", {});
      expect(tools.status).toBe(200);
      expect(tools.body.result.tools.map((t: { name: string }) => t.name))
        .toContain("lookout_list_projects");
      expect(tools.body.result.tools.every((t: { annotations?: { readOnlyHint?: boolean } }) =>
        t.annotations?.readOnlyHint === true)).toBe(true);
    } finally {
      if (prior === undefined) delete process.env.LOOKOUT_MCP_OWNER_TOKEN;
      else process.env.LOOKOUT_MCP_OWNER_TOKEN = prior;
    }
  });

});
