import "dotenv/config";
import { GitHubAdapter } from "@lookout/connectors";
import { assessProject } from "@lookout/core";
import { aiConfigured, buildBrief } from "@lookout/agents";
import {
  closeDatabase, createSyncRun, finishSyncRun, lookupHash,
  saveAssessment, stableSnapshotHash
} from "@lookout/db";

const mode = process.argv[2] ?? "once";
if (mode !== "once" && mode !== "watch") {
  console.error("Usage: npm run sync (one-off) or npm run worker (scheduled)");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL || !process.env.GITHUB_TOKEN) {
  console.error("Set DATABASE_URL and GITHUB_TOKEN in .env, then run npm run db:migrate");
  process.exitCode = 1;
} else {
  const adapter = new GitHubAdapter({
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER || undefined,
    maxRepos: Number(process.env.LOOKOUT_MAX_REPOS ?? 25),
    includeForks: process.env.LOOKOUT_INCLUDE_FORKS === "true"
  });

  async function runOnce() {
    const id = await createSyncRun();
    let count = 0;
    try {
      console.log("Discovering repositories...");
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
        console.log(snapshot.slug + ": " + assessment.findings.length + " attention item(s)");
        count++;
      }
      await finishSyncRun(id, "completed", count);
      console.log("Lookout synchronised " + count + " repositories");
    } catch (error) {
      await finishSyncRun(id, "failed", count, String(error));
      console.error("Lookout sync failed:", error);
      if (mode === "once") process.exitCode = 1;
    }
  }

  if (mode === "once") {
    try { await runOnce(); } finally { await closeDatabase(); }
  } else {
    const minutes = Math.max(15, Number(process.env.LOOKOUT_POLL_MINUTES ?? 60));
    console.log("Lookout worker started (every " + minutes + " minutes)");
    // Avoid overlapping sync cycles; the interval begins after the previous run finishes.
    let stopped = false;
    const stop = () => { stopped = true; };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    while (!stopped) {
      await runOnce();
      await new Promise(resolve => setTimeout(resolve, minutes * 60_000));
    }
    await closeDatabase();
  }
}
