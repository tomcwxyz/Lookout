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
});
