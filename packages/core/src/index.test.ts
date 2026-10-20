import { describe, expect, it } from "vitest";
import { assessProject, daysSince, type ProjectSnapshot } from "./index";

const now = new Date("2026-10-20T12:00:00Z");
const fixture: ProjectSnapshot = {
  provider: "github", providerId: "1", slug: "org/project", name: "project",
  url: "https://github.com/org/project", description: null,
  defaultBranch: "main", archived: false,
  observedAt: now.toISOString(), lastActivityAt: "2026-10-19T00:00:00Z",
  branches: [
    { name: "main", sha: "a", isDefault: true, lastCommitAt: "2026-01-01T00:00:00Z", url: "https://github.com/org/project/tree/main" },
    { name: "feat/test", sha: "b", isDefault: false, lastCommitAt: "2026-09-01T00:00:00Z", url: "https://github.com/org/project/tree/feat/test" }
  ],
  pullRequests: [], openIssues: 0, latestWorkflow: null
};

describe("project assessment", () => {
  it("ignores the default branch but flags an old feature branch", () => {
    const assessed = assessProject(fixture, { now });
    expect(assessed.findings).toHaveLength(1);
    expect(assessed.findings[0]?.key).toBe("stale_branch:feat/test");
  });

  it("does not flag branches when commit dates were unavailable", () => {
    const assessed = assessProject({ ...fixture, branches: fixture.branches.map(b => ({ ...b, lastCommitAt: null })) }, { now });
    expect(assessed.findings).toHaveLength(0);
  });

  it("flags a failed completed workflow but not a running workflow", () => {
    const run = { id: 42, name: "CI", status: "completed", conclusion: "failure",
      url: "https://github.com/org/project/actions/runs/42", createdAt: now.toISOString(), branch: "main" };
    expect(assessProject({ ...fixture, branches: [], latestWorkflow: run }, { now }).findings[0]?.severity).toBe("critical");
    expect(assessProject({ ...fixture, branches: [], latestWorkflow: { ...run, status: "in_progress" } }, { now }).findings).toHaveLength(0);
  });

  it("treats unknown and future timestamps as unknown", () => {
    expect(daysSince("invalid", now)).toBeNull();
    expect(daysSince("2026-10-21T00:00:00Z", now)).toBeNull();
  });
});
