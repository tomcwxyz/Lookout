import { describe, it, expect } from "vitest";
import { GitHubAdapter } from "./github";

function mockResponse(data: unknown): Response {
  return { ok: true, json: async () => data } as Response;
}

describe("GitHub observer", () => {
  it("discovers public and private repositories beyond the old 25 limit, without inspecting them", async () => {
    const calls: string[] = [];
    const mockFetch = (async (url: string) => {
      calls.push(url);
      if (!url.includes("/user/repos?")) throw new Error("Discovery must only list repositories");
      const page = Number(new URL(url).searchParams.get("page"));
      if (page > 1) return mockResponse([]);
      return mockResponse(Array.from({ length: 60 }, (_, i) => ({
        id: i + 1, full_name: "owner/repo-" + i, name: "repo-" + i,
        html_url: "https://github.com/owner/repo-" + i, description: null,
        default_branch: "main", pushed_at: null, archived: false, fork: false,
        private: i >= 35
      })));
    }) as typeof fetch;
    const adapter = new GitHubAdapter({ token: "test", fetchImpl: mockFetch });
    const inventory = await adapter.discoverInventory();
    expect(inventory).toHaveLength(60);
    expect(inventory.filter(r => r.visibility === "private")).toHaveLength(25);
    expect(calls.every(url => url.includes("/user/repos?"))).toBe(true);
  });

  it("returns evidence-backed branches, PRs and issue count without counting PRs as issues", async () => {
    const calls: string[] = [];
    const mockFetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("/user/repos?")) return mockResponse([{
        id: 17, full_name: "org/one", name: "one", html_url: "https://github.com/org/one",
        description: null, default_branch: "main", pushed_at: "2026-10-15T00:00:00Z",
        archived: false, fork: false
      }]);
      if (url.includes("/branches?")) return mockResponse([{ name: "main", commit: { sha: "abc" } }]);
      if (url.includes("/pulls?")) return mockResponse([{
        number: 5, title: "An update", html_url: "https://github.com/org/one/pull/5",
        head: { ref: "feat/x" }, created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-18T00:00:00Z", draft: false
      }]);
      if (url.includes("/issues?")) return mockResponse([{ number: 4 }, { number: 5, pull_request: {} }]);
      if (url.includes("/actions/runs?")) return mockResponse({ workflow_runs: [] });
      if (url.includes("/commits/abc")) return mockResponse({ commit: { committer: { date: "2026-10-19T00:00:00Z" }, author: null } });
      throw new Error("Unexpected URL " + url);
    }) as typeof fetch;

    const adapter = new GitHubAdapter({ token: "not-a-real-token", maxRepos: 5, fetchImpl: mockFetch });
    const projects = await adapter.discover();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.openIssues).toBe(1);
    expect(projects[0]?.pullRequests[0]?.number).toBe(5);
    expect(projects[0]?.branches[0]?.lastCommitAt).toBe("2026-10-19T00:00:00Z");
    expect(calls.every(url => url.startsWith("https://api.github.com/"))).toBe(true);
  });
});
