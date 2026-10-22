import { GitHubAdapter, NeonAdapter, VercelAdapter } from "@lookout/connectors";
import { assessInfrastructure, assessProject, type InfrastructureProvider, type InfrastructureResource } from "@lookout/core";
import { aiConfigured, buildBrief } from "@lookout/agents";
import {
  withObservationLease, createSyncRun, finishSyncRun, lookupHash,
  saveAssessment, stableSnapshotHash, beginSourceSync, completeSourceSync,
  saveInfrastructureObservation, saveRepositoryInventory, getGithubScanOffset,
  advanceGithubScanOffset, markRepositoryInspected
} from "@lookout/db";

export const observationProviders = ["github", "neon", "vercel"] as const;
export type ObservationProvider = typeof observationProviders[number];
export type ObservationResult = { provider: ObservationProvider; status: "completed" | "partial"; count: number; inventoried?: number; failures?: number };

function requireConfiguration(provider: ObservationProvider) {
  if (!process.env.DATABASE_URL) throw new Error("Lookout DATABASE_URL is not configured");
  const tokenName: Record<ObservationProvider, string> = {
    github: "GITHUB_TOKEN", neon: "NEON_API_KEY", vercel: "VERCEL_API_TOKEN"
  };
  if (!process.env[tokenName[provider]]) throw new Error(provider + " observation token is not configured");
}

async function syncGithub(): Promise<{ count: number; inventoried: number; failures: number }> {
  const adapter = new GitHubAdapter({
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER || undefined,
    maxRepos: Number(process.env.LOOKOUT_MAX_REPOS ?? 500),
    includeForks: process.env.LOOKOUT_INCLUDE_FORKS === "true",
    maxBranchesPerRepo: Number(process.env.LOOKOUT_MAX_BRANCHES_PER_REPO ?? 15)
  });
  const id = await createSyncRun();
  let count = 0;
  try {
    // Lightweight listing exposes every accessible repository (including private
    // repos permitted by the token), before bounded, expensive detail inspections.
    const [inventory, repositories] = await Promise.all([adapter.discoverInventory(), adapter.listRepos()]);
    await saveRepositoryInventory(inventory);
    const size = Math.min(30, Math.max(1, Number(process.env.LOOKOUT_GITHUB_BATCH_SIZE ?? 15)));
    const storedOffset = await getGithubScanOffset();
    const start = storedOffset >= repositories.length ? 0 : storedOffset;
    const batch = repositories.slice(start, start + size);
    let failures = 0;
    for (let offset = 0; offset < batch.length; offset += 3) {
      await Promise.all(batch.slice(offset, offset + 3).map(async repo => {
        try {
          const snapshot = await adapter.inspect(repo);
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
          await markRepositoryInspected(snapshot.providerId);
          count++;
        } catch (error) {
          failures++;
          // Do not replace a previous successful observation with an empty one.
          await markRepositoryInspected(String(repo.id), String(error));
          console.error("Lookout repository inspection failed for " + repo.full_name, error);
        }
      }));
    }
    await advanceGithubScanOffset(start + batch.length >= repositories.length ? 0 : start + batch.length);
    await finishSyncRun(id, failures ? "partial" : "completed", count,
      failures ? failures + " repository inspections failed; previous observations retained" : undefined);
    return { count, inventoried: inventory.length, failures };
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
    let github: { count: number; inventoried: number; failures: number } | null = null;
    switch (provider) {
      case "github":
        github = await syncGithub();
        count = github.count;
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
    return { provider, status: github?.failures ? "partial" : "completed", count,
      ...(github ? { inventoried: github.inventoried, failures: github.failures } : {}) };
  });
}
