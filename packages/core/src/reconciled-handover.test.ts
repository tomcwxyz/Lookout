import { describe, expect, it } from "vitest";
import { parseSessionHandover, reconcileSession } from "./reconciled-handover";
const report = {
  eventId: "agent-session-001", agent: "Claude", title: "Fixed importer",
  aim: "Repair import", summary: "Implemented and locally checked",
  next: "Run browser acceptance", done: ["Adjusted parser"], notDone: ["Mobile QA"],
  decisions: ["Keep preview-only"], blockers: [], addresses: [],
  basedOnRevision: 2, workstream: "importer"
};
describe("reconciled handovers", () => {
  it("incorporates only against the revision actually read", () => {
    const p = parseSessionHandover(report);
    expect(reconcileSession(p, 2).status).toBe("incorporated");
    expect(reconcileSession(p, 3).status).toBe("needs_review");
  });
  it("keeps reports without prior context, but does not promote them", () => {
    const p = parseSessionHandover({...report, basedOnRevision: undefined});
    expect(reconcileSession(p, 0).status).toBe("needs_review");
    expect(reconcileSession(p, 0).trust).toBe("agent_reported");
  });
  it("proposes closures but never treats them as independently verified", () => {
    const p = parseSessionHandover({...report, addresses: ["earlier-session-01"]});
    const outcome = reconcileSession(p, 2, "pr_observed");
    expect(outcome.proposedClosures).toEqual(["earlier-session-01"]);
    expect(outcome.reason).toContain("unverified");
  });
  it("rejects invalid revisions and untrusted links", () => {
    expect(() => parseSessionHandover({...report, basedOnRevision: -1})).toThrow();
    expect(() => parseSessionHandover({...report, prUrl: "https://evil.example/pr/9"})).toThrow();
  });
});
