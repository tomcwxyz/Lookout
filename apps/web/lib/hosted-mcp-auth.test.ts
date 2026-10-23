import { describe, expect, it, vi } from "vitest";
vi.mock("@lookout/db", () => ({
  authoriseOAuthAccessToken: vi.fn(async (raw: string) => raw === "lk_oat_" + "a".repeat(64)),
  authoriseAgentToken: vi.fn(async (raw: string) =>
    raw === "lkp_" + "a".repeat(64) ? { id: 1, projectId: 7 } : null)
}));
import { authoriseHostedMcp, mcpBearer, ownerTokenMatches } from "./hosted-mcp-auth";

describe("hosted MCP access boundaries", () => {
  const owner = "x".repeat(64);
  it("requires a strong, exact owner token", () => {
    expect(ownerTokenMatches(owner, owner)).toBe(true);
    expect(ownerTokenMatches(owner, "short")).toBe(false);
    expect(ownerTokenMatches(owner + "z", owner)).toBe(false);
    expect(ownerTokenMatches(null, owner)).toBe(false);
  });
  it("accepts only one well-formed Bearer header", () => {
    expect(mcpBearer("Bearer " + owner)).toBe(owner);
    expect(mcpBearer("Basic " + owner)).toBeNull();
    expect(mcpBearer("Bearer " + owner + " other")).toBeNull();
    expect(mcpBearer(null)).toBeNull();
  });
  it("distinguishes portfolio owner from scoped project tokens", async () => {
    expect(await authoriseHostedMcp("Bearer " + owner, owner)).toEqual({ scope: "owner" });
    expect(await authoriseHostedMcp("Bearer lkp_" + "a".repeat(64), owner))
      .toEqual({ scope: "project", projectId: 7, tokenId: 1 });
    expect(await authoriseHostedMcp("Bearer lkp_" + "b".repeat(64), owner)).toBeNull();
    expect(await authoriseHostedMcp("Bearer " + owner.slice(1), owner)).toBeNull();
    expect(await authoriseHostedMcp("Bearer lk_oat_" + "a".repeat(64), owner)).toEqual({ scope: "owner" });
    expect(await authoriseHostedMcp("Bearer lk_oat_" + "b".repeat(64), owner)).toBeNull();
  });
});
