import { GitHubAdapter, NeonAdapter, VercelAdapter } from "@lookout/connectors";
import { assessInfrastructure, assessProject, type InfrastructureProvider, type InfrastructureResource } from "@lookout/core";
import { aiConfigured, buildBrief } from "@lookout/agents";
import {
  withObservationLease, createSyncRun, finishSyncRun, lookupHash,
  saveAssessment, stableSnapshotHash, beginSourceSync, completeSourceSync,
  saveInfrastructureObservation
} from "@lookout/db";

export const observationProviders = ["github", "neon", "vercel"] as const;
export type ObservationProvider = typeof observationProviders[number];
export type ObservationResult = { provider: ObservationProvider; status: "completed"; count: number };

function requireConfiguration(provider: ObservationProvider) {
  if (!process.env.DATABASE_URL) throw new Error("Lookout DATABASE_URL is not configured");
  const tokenName: Record<ObservationProvider, string> = {
    github: "GITHUB_TOKEN", neon: "NEON_API_KEY", vercel: "VERCEL_API_TOKEN"
  };
  if (!process.env[tokenName[provider]]) throw new Error(provider + " observation token is not configured");
}

async function syncGithub(): Promise<number> {
  const adapter = new GitHubAdapter({
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER || undefined,
    maxRepos: Number(process.env.LOOKOUT_MAX_REPOS ?? 25),
    includeForks: process.env.LOOKOUT_INCLUDE_FORKS === "true"
  });
  const id = await createSyncRun();
  let count = 0;
  try {
    const snapshots = await adapter.discover();
    for (const snapshot of snapshots) {
      const assessment = assessProject(snapshot, {
        staleBranchDays: Number(process.env.LOOKOUT_STALE_BRANCH_DAYS ?? 14),
        stalePrDays: Number(process.env.LOOKOUT_STALE_PR_DAYS ?? 14)
      });
      let brief: string | null = null;
      if (aiConfigured()) {
        const hash = stableSnapshotHash(assessment);
        const previous = await lookupHash(snapshot.providerId);
        if (previous?.hash !== hash) {
          try { brief = await buildBrief(assessment); }
          catch (error) { console.error("Lookout AI brief failed for " + snapshot.slug, error); }
        }
      }
      await saveAssessment(assessment, brief);
      count++;
    }
    await finishSyncRun(id, "completed", count);
    return count;
  } catch (error) {
    await finishSyncRun(id, "failed", count, String(error));
    throw error;
  }
}

async function syncInfrastructure(
  provider: InfrastructureProvider,
  discover: () => Promise<InfrastructureResource[]>
): Promise<number> {
  const id = await beginSourceSync(provider);
  try {
    const resources = await discover();
    const findings = assessInfrastructure(resources, {
      branchReviewDays: Number(process.env.LOOKOUT_DB_BRANCH_REVIEW_DAYS ?? 30)
    });
    const count = await saveInfrastructureObservation(provider, resources, findings);
    await completeSourceSync(id, "completed", count);
    return count;
  } catch (error) {
    await completeSourceSync(id, "failed", 0, String(error));
    throw error;
  }
}

/** Called by Vercel cron routes and the CLI. All provider calls are read-only. */
export async function runObservation(provider: ObservationProvider): Promise<ObservationResult> {
  requireConfiguration(provider);
  return withObservationLease(provider, async () => {
    let count: number;
    switch (provider) {
      case "github":
        count = await syncGithub();
        break;
      case "neon":
        count = await syncInfrastructure("neon", () =>
          new NeonAdapter({
            token: process.env.NEON_API_KEY!,
            orgId: process.env.NEON_ORG_ID || undefined,
            maxProjects: Number(process.env.LOOKOUT_NEON_MAX_PROJECTS ?? 30)
          }).discover()
        );
        break;
      case "vercel":
        count = await syncInfrastructure("vercel", () =>
          new VercelAdapter({
            token: process.env.VERCEL_API_TOKEN!,
            teamId: process.env.VERCEL_TEAM_ID || undefined,
            maxProjects: Number(process.env.LOOKOUT_VERCEL_MAX_PROJECTS ?? 30)
          }).discover()
        );
        break;
    }
    console.log("Lookout " + provider + ": observed " + count + " resources");
    return { provider, status: "completed", count };
  });
}
