import { describe, expect, it } from "vitest";
import { parseContribution } from "./contribution";
const cp = {
  version: 1, eventId: "relay:alpha:test-001", agent: "Codex", title: "Field test pending",
  objective: "Validate Relay field test", summary: "Automated tests passed locally; physical Windows testing is pending.",
  implemented: ["Added field lab runner"], remaining: ["Run on two devices"],
  tests: [{ description: "Unit tests", result: "passed_claimed" }],
  decisions: [], blockers: ["Windows Defender quarantine"],
};
describe("agent contribution contract", () => {
  it("accepts bounded, attributed reports and preserves claimed-only evidence", () => {
    const c = parseContribution({ kind: "blocker", checkpoint: cp });
    expect(c.kind).toBe("blocker");
    expect(c.checkpoint.tests[0]?.result).toBe("passed_claimed");
  });
  it("rejects unknown kinds and malformed checkpoints", () => {
    expect(() => parseContribution({ kind: "confirmed_complete", checkpoint: cp })).toThrow("Invalid contribution kind");
    expect(() => parseContribution({ kind: "progress", checkpoint: { ...cp, version: 2 } })).toThrow();
    expect(() => parseContribution({ kind: "evidence", checkpoint: { ...cp, eventId: "bad" } })).toThrow();
  });
  it("rejects oversized content", () => {
    expect(() => parseContribution({ kind: "progress", checkpoint: { ...cp, summary: "x".repeat(2600) } })).toThrow();
  });
});
