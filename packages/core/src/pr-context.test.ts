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
  it("handles empty body and discussion without inventing work", () => {
    const p = parsePullRequestContext(null, [{author:"Reviewer",body:"Please check the mobile layout.\nThanks",createdAt:"2026-10-20"}]);
    expect(p.summary).toBeNull();
    expect(p.discussion).toEqual(["Reviewer: Please check the mobile layout."]);
  });
});
