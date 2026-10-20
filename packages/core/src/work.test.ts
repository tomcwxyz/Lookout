import { describe, expect, it } from "vitest";
import { deriveWorkHandover } from "./work";
import type { ProjectSnapshot } from "./index";
const snapshot: ProjectSnapshot = {
  provider: "github", providerId: "1", slug: "org/repo", name: "repo",
  url: "https://github.com/org/repo", description: null, defaultBranch: "main",
  archived: false, branches: [], pullRequests: [], openIssues: 0,
  lastActivityAt: null, latestWorkflow: null, observedAt: "2026-10-20T12:00:00Z"
};
const now = new Date("2026-10-20T12:00:00Z");
describe("work handovers", () => {
  it("distinguishes open review, draft and paused work", () => {
    const d = deriveWorkHandover({ ...snapshot, pullRequests: [
      { number: 1, title: "Needs review", url: "https://github.com/org/repo/pull/1", branch: "feat", createdAt: now.toISOString(), updatedAt: now.toISOString(), draft: false, requestedReviewers: 1 },
      { number: 2, title: "Draft feature", url: "https://github.com/org/repo/pull/2", branch: "draft", createdAt: now.toISOString(), updatedAt: now.toISOString(), draft: true },
      { number: 3, title: "Old feature", url: "https://github.com/org/repo/pull/3", branch: "old", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", draft: false }
    ]}, now);
    expect(d.items.map(i => i.stage)).toEqual(["needs_review", "in_progress", "possibly_paused"]);
  });
  it("does not mistake an unchecked plan for proof that work was never built", () => {
    const d = deriveWorkHandover({ ...snapshot,
      planningDocuments: [{ path: "ROADMAP.md", url: "https://github.com/org/repo/blob/main/ROADMAP.md",
        tasks: [{ text: "Ship dashboard", done: false, line: 5 }, { text: "Test dashboard", done: true, line: 6 }] }],
      recentMerges: [{ number: 14, title: "Ship dashboard", url: "https://github.com/org/repo/pull/14", mergedAt: now.toISOString(), branch: "feat" }]
    }, now);
    expect(d.counts.integrated).toBe(1);
    expect(d.counts.planned).toBe(1);
    expect(d.counts.marked_done).toBe(1);
    expect(d.items.find(i => i.stage === "planned")?.explanation).toContain("out of date");
    expect(d.items.find(i => i.stage === "integrated")?.explanation).toContain("unverified");
  });
  it("recognises explicit QA labels and preserves issue links", () => {
    const d = deriveWorkHandover({ ...snapshot, workIssues: [
      { number: 2, title: "Test import", url: "https://github.com/org/repo/issues/2", updatedAt: now.toISOString(), labels: ["QA"] },
      { number: 3, title: "Explore connector", url: "https://github.com/org/repo/issues/3", updatedAt: now.toISOString(), labels: [] }
    ]}, now);
    expect(d.items[0]?.stage).toBe("needs_testing");
    expect(d.items[1]?.stage).toBe("planned");
    expect(d.items[0]?.evidenceUrl).toBe("https://github.com/org/repo/issues/2");
  });
  it("handles pre-upgrade snapshots without making up content", () => {
    const d = deriveWorkHandover(snapshot, now);
    expect(d.items).toEqual([]);
    expect(d.coverage).toContain("not scanned");
  });
  it("does not call every open PR human review; records next steps and evidence", () => {
    const d = deriveWorkHandover({ ...snapshot, pullRequests: [
      { number: 11, title: "Improve mapping", url: "https://github.com/org/repo/pull/11",
        branch: "feat/map", createdAt: now.toISOString(), updatedAt: now.toISOString(), draft: false,
        reviewStatus: "none", checks: "unknown", requestedReviewers: 0,
        body: "## Summary\nMake maps usable on mobile.\n## Delivered\n- Better zoom controls\n## Follow-up\n- Test drawing with two fingers" },
      { number: 12, title: "Dependency bump", url: "https://github.com/org/repo/pull/12",
        branch: "bot", createdAt: now.toISOString(), updatedAt: now.toISOString(),
        draft: false, isBot: true }
    ] }, now);
    expect(d.items[0]?.stage).toBe("awaiting_decision");
    expect(d.items[0]?.summary).toContain("maps usable on mobile");
    expect(d.items[0]?.nextAction).toBe("Test drawing with two fingers");
    expect(d.items[1]?.stage).toBe("maintenance");
  });
  it("prioritises changes requested, failing checks and explicit verification", () => {
    const make = (number: number, patch: Record<string, unknown>) => ({
      number, title: "Change", url: "https://github.com/org/repo/pull/" + number,
      branch: "feat", createdAt: now.toISOString(), updatedAt: now.toISOString(),
      draft: false, ...patch
    });
    const d = deriveWorkHandover({ ...snapshot, pullRequests: [
      make(1, { reviewStatus: "changes_requested" }),
      make(2, { checks: "failure" }),
      make(3, { body: "## Testing\n- [ ] Verify on Windows" }),
      make(4, { reviewStatus: "approved", checks: "success" })
    ] }, now);
    expect(d.items.map(i => i.stage)).toEqual(["checks_failing", "changes_requested", "needs_testing", "review_approved"]);
  });

});
