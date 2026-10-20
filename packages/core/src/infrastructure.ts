export type InfrastructureProvider = "neon" | "vercel";
export type InfrastructureKind = "neon_project" | "neon_branch" | "vercel_project" | "vercel_deployment";
export type InfrastructureFindingKind = "long_lived_db_branch" | "failed_deployment";

export type InfrastructureResource = {
  key: string;
  provider: InfrastructureProvider;
  kind: InfrastructureKind;
  name: string;
  url: string;
  parentKey: string | null;
  /** Only set using provider-supplied authoritative Git repository identity. */
  gitRepository: string | null;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  status: string | null;
  /** Number of compute endpoints, NOT number running or a measure of billed usage. */
  endpointCount: number | null;
  /** Deliberately small, non-secret fields only. Never store credentials or raw API responses. */
  details: Record<string, string | number | boolean | null>;
  observedAt: string;
};

export type InfrastructureFinding = {
  key: string;
  resourceKey: string;
  kind: InfrastructureFindingKind;
  severity: "warning" | "critical";
  title: string;
  explanation: string;
  evidenceUrl: string;
  observedAt: string;
};

function ageDays(value: string | null, now: Date): number | null {
  if (!value) return null;
  const date = Date.parse(value);
  if (!Number.isFinite(date) || date > now.getTime()) return null;
  return Math.floor((now.getTime() - date) / 86_400_000);
}

export function assessInfrastructure(resources: InfrastructureResource[], options: {
  now?: Date;
  branchReviewDays?: number;
} = {}): InfrastructureFinding[] {
  const now = options.now ?? new Date();
  const branchReviewDays = options.branchReviewDays ?? 30;
  const findings: InfrastructureFinding[] = [];

  for (const resource of resources) {
    if (resource.kind === "neon_branch" && !resource.isDefault) {
      const createdAge = ageDays(resource.createdAt, now);
      // Neon branch "updated_at" is NOT proof of the last SQL query or data change.
      // We alert on lifetime, not on an unverified claim of inactivity or cost.
      if (createdAge !== null && createdAge >= branchReviewDays) {
        findings.push({
          key: "long_lived_db_branch",
          resourceKey: resource.key, kind: "long_lived_db_branch", severity: "warning",
          title: "Review long-lived database branch: " + resource.name,
          explanation: "This non-default Neon branch was created " + createdAge +
            " days ago and has " + (resource.endpointCount ?? "an unknown number of") +
            " compute endpoint(s). This is a lifecycle review, NOT a verified cost or inactivity finding.",
          evidenceUrl: resource.url, observedAt: resource.observedAt
        });
      }
    }
    if (resource.kind === "vercel_deployment" && ["ERROR", "BLOCKED"].includes(resource.status ?? "")) {
      findings.push({
        key: "failed_deployment",
        resourceKey: resource.key, kind: "failed_deployment", severity: "critical",
        title: "Review " + (resource.details.target ?? "latest") + " deployment: " + resource.name,
        explanation: "The newest observed deployment for this environment has status " + resource.status +
          ". Check the deployment before considering the environment healthy.",
        evidenceUrl: resource.url, observedAt: resource.observedAt
      });
    }
  }
  return findings;
}

/** Exact provider repository identity only. Never match a DB project by its display name. */
export function normaliseGitRepo(value: string | null): string | null {
  if (!value) return null;
  const parsed = value.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(parsed) ? parsed.toLowerCase() : null;
}
