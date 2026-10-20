import { describe, expect, it } from "vitest";
import { assessInfrastructure, normaliseGitRepo, type InfrastructureResource } from "./infrastructure";

const base: InfrastructureResource = {
  key: "neon:branch:db-1:br-1", provider: "neon", kind: "neon_branch",
  name: "development", url: "https://console.neon.tech/app/projects/db-1/branches/br-1",
  parentKey: "neon:project:db-1", gitRepository: null, isDefault: false,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: null, endpointCount: 0,
  status: null, details: {}, observedAt: "2026-10-20T12:00:00Z"
};

describe("infrastructure rules", () => {
  it("flags ageing secondary branches without implying usage or billed cost", () => {
    const [finding] = assessInfrastructure([base], { now: new Date("2026-10-20T12:00:00Z") });
    expect(finding?.kind).toBe("long_lived_db_branch");
    expect(finding?.explanation).toContain("NOT a verified cost");
  });
  it("never flags default Neon branch regardless of age", () => {
    expect(assessInfrastructure([{ ...base, isDefault: true }], { now: new Date("2026-10-20T12:00:00Z") })).toHaveLength(0);
  });
  it("only flags failed latest deployments", () => {
    const deployment: InfrastructureResource = { ...base, key: "vercel:deployment:123", provider: "vercel",
      kind: "vercel_deployment", name: "site", status: "ERROR", details: { target: "production" } };
    expect(assessInfrastructure([deployment])).toHaveLength(1);
    expect(assessInfrastructure([{ ...deployment, status: "READY" }])).toHaveLength(0);
  });
  it("accepts only exact GitHub-style repository identities", () => {
    expect(normaliseGitRepo("https://github.com/Org/Repo.git")).toBe("org/repo");
    expect(normaliseGitRepo("my-site")).toBeNull();
    expect(normaliseGitRepo("https://example.com/Org/Repo")).toBeNull();
  });
});
