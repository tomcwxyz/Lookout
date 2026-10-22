import { describe, expect, it, vi } from "vitest";
vi.mock("@lookout/db", () => ({
  authoriseAgentToken: vi.fn(async (raw: string) =>
    raw === "lkp_" + "a".repeat(64) ? { id: 5, projectId: 7, label: "Test agent" } : null),
  authoriseOAuthAccessToken: vi.fn(async () => false),
  getPortfolio: vi.fn(async () => ({ projects: [], attention: [], workDecisions: [] })),
  getLogicalPortfolio: vi.fn(async () => ({ projects: [], coverage: {} })),
  getProject: vi.fn(async () => ({ project: null, findings: [], decisions: [] })),
  getAgentHandover: vi.fn(async () => null),
  getInfrastructurePortfolio: vi.fn(async () => ({ resources: [], findings: [] })),
  getLinkedResources: vi.fn(async () => []),
  getPortfolioIdForObservedProject: vi.fn(async () => 3),
  listPortfolioContributions: vi.fn(async () => []),
  getPortfolioContributionHandover: vi.fn(async () => null),
  submitAgentContribution: vi.fn(async () => ({ id: 2, duplicate: false, trust: "agent_reported" })),
  ContributionConflictError: class extends Error {},
  ContributionScopeError: class extends Error {},
  ContributionRateLimitError: class extends Error {}
}));
import { POST } from "../app/api/mcp/route";
import { submitAgentContribution } from "@lookout/db";
import type { NextRequest } from "next/server";

async function send(token: string, method: string, params: unknown) {
  const url = "https://lookout.example/api/mcp";
  const req = new Request(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json",
      Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  }) as NextRequest;
  Object.defineProperty(req, "nextUrl", { value: new URL(url) });
  const response = await POST(req);
  const raw = await response.text();
  const dataLine = raw.split("\n").find(line => line.startsWith("data: "));
  return { status: response.status, body: JSON.parse(dataLine ? dataLine.slice(6) : raw) };
}
const checkpoint = {
  version: 1, eventId: "agent:check:00001", agent: "Codex", title: "Tests checked",
  objective: "Verify branch", summary: "Claimed local checks passed",
  implemented: [], remaining: ["Human acceptance"], tests: [], decisions: [], blockers: []
};
describe("hosted MCP contribution permissions", () => {
  it("keeps the owner's ChatGPT MCP tool inventory read-only", async () => {
    const owner = "z".repeat(64);
    const prior = process.env.LOOKOUT_MCP_OWNER_TOKEN;
    process.env.LOOKOUT_MCP_OWNER_TOKEN = owner;
    try {
      const response = await send(owner, "tools/list", {});
      expect(response.status).toBe(200);
      const tools = response.body.result.tools as Array<{name:string;annotations:{readOnlyHint:boolean}}>;
      expect(tools.some(t => t.name === "lookout_submit_contribution")).toBe(false);
      expect(tools.some(t => t.name === "lookout_list_contributions")).toBe(true);
      expect(tools.every(t => t.annotations.readOnlyHint)).toBe(true);
    } finally {
      if (prior === undefined) delete process.env.LOOKOUT_MCP_OWNER_TOKEN;
      else process.env.LOOKOUT_MCP_OWNER_TOKEN = prior;
    }
  });
  it("exposes write only to the project token and passes its verified token ID", async () => {
    const token = "lkp_" + "a".repeat(64);
    const list = await send(token, "tools/list", {});
    expect(list.status).toBe(200);
    const tool = list.body.result.tools.find((t: {name:string}) => t.name === "lookout_submit_contribution");
    expect(tool.annotations.readOnlyHint).toBe(false);
    const called = await send(token, "tools/call", {
      name: "lookout_submit_contribution", arguments: { kind: "progress", checkpoint }
    });
    expect(called.status).toBe(200);
    expect(submitAgentContribution).toHaveBeenCalledWith(7, 5, {kind:"progress", checkpoint});
  });
});
