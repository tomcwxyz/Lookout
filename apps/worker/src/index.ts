import "dotenv/config";
import { observationProviders, runObservation } from "./run";

const mode = process.argv[2] ?? "once";
if (mode !== "once" && mode !== "watch") {
  console.error("Usage: npm run sync (once) or npm run worker (watch)");
  process.exitCode = 1;
} else {
  const run = async () => {
    const available = observationProviders.filter(provider => {
      const variable = { github: "GITHUB_TOKEN", neon: "NEON_API_KEY", vercel: "VERCEL_API_TOKEN" }[provider];
      return Boolean(process.env[variable]);
    });
    if (!available.length || !process.env.DATABASE_URL) {
      console.error("Set DATABASE_URL and at least one provider token");
      process.exitCode = 1;
      return;
    }
    for (const provider of available) {
      try { await runObservation(provider); }
      catch (error) { console.error(provider + " observation failed", error); process.exitCode = 1; }
    }
  };
  if (mode === "once") {
    await run();
  } else {
    const minutes = Math.max(15, Number(process.env.LOOKOUT_POLL_MINUTES ?? 60));
    let stopping = false;
    process.on("SIGINT", () => { stopping = true; });
    process.on("SIGTERM", () => { stopping = true; });
    while (!stopping) {
      await run();
      await new Promise<void>(resolve => setTimeout(resolve, minutes * 60_000));
    }
  }
}
