import { describe, expect, it } from "vitest";
import { NeonAdapter } from "./neon";
import { VercelAdapter } from "./vercel";

function json(data: unknown) { return { ok: true, json: async () => data } as Response; }

describe("Neon read-only observer", () => {
  it("collects project and branches, checks endpoint membership and never calls mutating methods", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      if (url.includes("/projects?")) return json({ projects: [{ id: "p1", name: "DB", default_branch_id: "main" }] });
      if (url.includes("/branches?")) return json({ branches: [
        { id: "main", name: "main", parent_id: null, created_at: "2026-01-01T00:00:00Z" },
        { id: "br2", name: "test", parent_id: "main", created_at: "2026-01-02T00:00:00Z" }
      ] });
      if (url.endsWith("/endpoints")) return json({ endpoints: [{ id: "ep1", branch_id: "br2", current_state: "idle" }] });
      throw new Error(url);
    }) as typeof fetch;
    const resources = await new NeonAdapter({ token: "test", fetchImpl }).discover();
    expect(resources).toHaveLength(3);
    expect(resources[1]?.isDefault).toBe(true);
    expect(resources[2]?.endpointCount).toBe(1);
    expect(calls.every(c => c.method === "GET")).toBe(true);

  });
});

describe("Vercel read-only observer", () => {
  it("links only exact GitHub repo metadata and retains latest per deployment target", async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes("/v9/projects")) return json({ projects: [{ id: "prj_1", name: "site", link: { type: "github", repo: "acme/site" } }] });
      if (url.includes("/v6/deployments")) return json({ deployments: [
        { uid: "new", name: "site", created: 2000, readyState: "READY", target: "production", url: "site.example.com" },
        { uid: "old", name: "site", created: 1000, readyState: "ERROR", target: "production", url: "old.example.com" }
      ] });
      throw new Error(url);
    }) as typeof fetch;
    const resources = await new VercelAdapter({ token: "test", fetchImpl }).discover();
    expect(resources).toHaveLength(2);
    expect(resources[0]?.gitRepository).toBe("acme/site");
    expect(resources[1]?.key).toBe("vercel:deployment:prj_1:production");
  });
  it("uses deployment Git metadata to identify a repository when project linkage is absent", async () => {
    const noLinkFetch = (async (url: string) => {
      if (url.includes("/v9/projects")) return json({ projects: [{ id: "prj_2", name: "name-does-not-match" }] });
      if (url.includes("/v6/deployments")) return json({ deployments: [{
        id: "dpl_2", name: "site", state: "READY", created: 50, meta: { githubOrg: "Org", githubRepo: "ActualRepo" }
      }] });
      throw new Error(url);
    }) as typeof fetch;
    const fromMetadata = await new VercelAdapter({ token: "test", fetchImpl: noLinkFetch }).discover();
    expect(fromMetadata[0]?.gitRepository).toBe("org/actualrepo");
    expect(fromMetadata[1]?.key).toBe("vercel:deployment:prj_2:preview");
  });
});
