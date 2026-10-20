import "dotenv/config";
import { GitHubAdapter, NeonAdapter, VercelAdapter } from "@lookout/connectors";
import { assessInfrastructure, assessProject, type InfrastructureProvider, type InfrastructureResource } from "@lookout/core";
import { aiConfigured, buildBrief } from "@lookout/agents";
import {
  closeDatabase, createSyncRun, finishSyncRun, lookupHash,
  saveAssessment, stableSnapshotHash, beginSourceSync, completeSourceSync,
  saveInfrastructureObservation
} from "@lookout/db";

const mode = process.argv[2] ?? "once";
const hasGithub = Boolean(process.env.GITHUB_TOKEN);
const hasNeon = Boolean(process.env.NEON_API_KEY);
const hasVercel = Boolean(process.env.VERCEL_API_TOKEN);

if (mode !== "once" && mode !== "watch") {
  console.error("Usage: npm run sync (one-off) or npm run worker (scheduled)");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL || !(hasGithub || hasNeon || hasVercel)) {
  console.error("Set DATABASE_URL and at least one of GITHUB_TOKEN, NEON_API_KEY or VERCEL_API_TOKEN.");
  process.exitCode = 1;
} else {
  async function syncGithub() {
    if (!hasGithub) return;
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
        const hash = stableSnapshotHash(assessment);
        const previous = await lookupHash(snapshot.providerId);
        let brief: string | null = null;
        if (aiConfigured() && previous?.hash !== hash) {
          try { brief = await buildBrief(assessment); }
          catch (error) { console.error("AI brief failed for " + snapshot.slug, error); }
        }
        await saveAssessment(assessment, brief);
        count++;
      }
      await finishSyncRun(id, "completed", count);
      console.log("GitHub: observed " + count + " repositories");
    } catch (error) {
      await finishSyncRun(id, "failed", count, String(error));
      throw error;
    }
  }

  async function syncInfrastructure(provider: InfrastructureProvider, discover: () => Promise<InfrastructureResource[]>) {
    const id = await beginSourceSync(provider);
    try {
      // Nothing is persisted if source discovery is incomplete.
      const resources = await discover();
      const findings = assessInfrastructure(resources, {
        branchReviewDays: Number(process.env.LOOKOUT_DB_BRANCH_REVIEW_DAYS ?? 30)
      });
      const count = await saveInfrastructureObservation(provider, resources, findings);
      await completeSourceSync(id, "completed", count);
      console.log(provider + ": observed " + count + " resources, " + findings.length + " attention items");
    } catch (error) {
      await completeSourceSync(id, "failed", 0, String(error));
      throw error;
    }
  }

  async function runOnce() {
    const failures: string[] = [];
    const tasks: Array<{ name: string; run: () => Promise<void> }> = [];
    // Observe GitHub first so Vercel's authoritative repository identity can be linked.
    if (hasGithub) tasks.push({ name: "github", run: syncGithub });
    if (hasNeon) {
      const adapter = new NeonAdapter({
        token: process.env.NEON_API_KEY!,
        orgId: process.env.NEON_ORG_ID || undefined,
        maxProjects: Number(process.env.LOOKOUT_NEON_MAX_PROJECTS ?? 30)
      });
      tasks.push({ name: "neon", run: () => syncInfrastructure("neon", () => adapter.discover()) });
    }
    if (hasVercel) {
      const adapter = new VercelAdapter({
        token: process.env.VERCEL_API_TOKEN!,
        teamId: process.env.VERCEL_TEAM_ID || undefined,
        maxProjects: Number(process.env.LOOKOUT_VERCEL_MAX_PROJECTS ?? 30)
      });
      tasks.push({ name: "vercel", run: () => syncInfrastructure("vercel", () => adapter.discover()) });
    }
    for (const task of tasks) {
      try { await task.run(); }
      catch (error) {
        console.error(task.name + " observation failed:", error);
        failures.push(task.name);
      }
    }
    if (failures.length) {
      console.error("Incomplete observation: " + failures.join(", ") + ". Prior observations have been retained.");
      if (mode === "once") process.exitCode = 1;
    }
  }

  if (mode === "once") {
    try { await runOnce(); } finally { await closeDatabase(); }
  } else {
    const minutes = Math.max(15, Number(process.env.LOOKOUT_POLL_MINUTES ?? 60));
    console.log("Lookout worker started (every " + minutes + " minutes)");
    let stopped = false;
    const stop = () => { stopped = true; };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    while (!stopped) {
      await runOnce();
      // Wake-up on SIGTERM will be introduced when the service supervisor is added.
      await new Promise(resolve => setTimeout(resolve, minutes * 60_000));
    }
    await closeDatabase();
  }
}
