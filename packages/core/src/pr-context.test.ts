import { describe, expect, it } from "vitest";
import { parsePullRequestContext } from "./pr-context";
describe("PR evidence reader", () => {
  it("extracts work, testing and follow-ups from a structured body", () => {
    const p = parsePullRequestContext([
      "## Summary", "Adds an import flow for the admin team.",
      "## What changed", "- Uploads CSV files", "- [x] Added validation",
      "## Testing", "- [x] Unit tests passed", "- [ ] Human smoke test on Windows",
      "## Follow-up", "- Check the deployment after merging",
      "## Risks", "- Historical files may have different encodings"
    ].join("\n"));
    expect(p.summary).toContain("import flow");
    expect(p.changes).toContain("Uploads CSV files");
    expect(p.testing[0]).toContain("PR marks complete:");
    expect(p.remaining).toEqual(["Human smoke test on Windows", "Check the deployment after merging"]);
    expect(p.risks).toHaveLength(1);
  });
  it("does not treat code fences or HTML comments as progress", () => {
    const p = parsePullRequestContext("## Changes\n~~~ts\n- [x] secret = true\n~~~\n<!-- hidden\n- [x] hidden\n-->\n- Public change");
    expect(p.changes).toEqual(["Public change"]);
  });
  it("understands named feature sections and explicit deployment gates", () => {
    const body = [
      "## What this branch does", "Watch is being prepared for editorial review.",
      "### Watch → editorial review", "- duplicate-safe promotion to a pending change",
      "### Watch 2.0 foundations", "- matching only across changed chunks",
      "## Deployment prerequisite", "Apply the remaining Watch migration before preview testing.",
      "## Merge gate", "- CI and Vercel preview green",
      "- exercise real funder pages", "- manual editorial review must pass"
    ].join("\n");
    const p = parsePullRequestContext(body);
    expect(p.summary).toContain("Watch is being prepared");
    expect(p.changes).toContain("duplicate-safe promotion to a pending change");
    expect(p.remaining[0]).toContain("Apply the remaining Watch migration");
    expect(p.remaining).toContain("exercise real funder pages");
  });
  it("handles empty body and discussion without inventing work", () => {
    const p = parsePullRequestContext(null, [{author:"Reviewer",body:"Please check the mobile layout.\nThanks",createdAt:"2026-10-20"}]);
    expect(p.summary).toBeNull();
    expect(p.discussion).toEqual(["Reviewer: Please check the mobile layout."]);
  });
});
