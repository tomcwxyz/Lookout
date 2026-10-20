"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Provider = "github" | "neon" | "vercel";
type ScanState = "idle" | "running" | "completed" | "failed" | "already_running";
type Result = { state: ScanState; count?: number; message?: string };
const providers: Provider[] = ["github", "neon", "vercel"];
const names: Record<Provider, string> = { github: "GitHub", neon: "Neon", vercel: "Vercel" };

export function ScanControls({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState<Provider[]>([]);
  const [results, setResults] = useState<Partial<Record<Provider, Result>>>({});

  async function scanOne(provider: Provider) {
    setResults(current => ({ ...current, [provider]: { state: "running" } }));
    try {
      const response = await fetch("/api/scan/" + provider, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const result = await response.json() as { status?: ScanState; count?: number; error?: string };
      if (!response.ok) {
        setResults(current => ({ ...current, [provider]: {
          state: response.status === 409 ? "already_running" : "failed",
          message: result.error ?? "Scan failed"
        } }));
      } else {
        setResults(current => ({ ...current, [provider]: { state: "completed", count: result.count } }));
      }
    } catch {
      setResults(current => ({ ...current, [provider]: {
        state: "failed", message: "Request failed or timed out. Check observation history."
      } }));
    } finally {
      setRunning(current => current.filter(value => value !== provider));
      router.refresh();
    }
  }

  function start(selected: Provider[]) {
    if (running.length) return;
    setRunning(selected);
    void Promise.all(selected.map(scanOne));
  }

  return <section className={"scan-controls" + (compact ? " scan-controls-compact" : "")} aria-label="Manual observations">
    <div className="scan-header">
      <div><strong>Refresh observations</strong><span>Run a read-only scan now, or keep using the automatic checks.</span></div>
      <button type="button" className="scan-all" disabled={running.length > 0} onClick={() => start(providers)}>
        {running.length ? "Scanning…" : "↻ Scan all"}
      </button>
    </div>
    <div className="scan-providers">
      {providers.map(provider => {
        const result = results[provider];
        return <div className="scan-provider" key={provider}>
          <span className="scan-provider-title">{names[provider]}</span>
          <span className={"scan-state scan-state-" + (result?.state ?? "idle")} role="status" aria-live="polite">
            {result?.state === "running" ? "Scanning…" :
              result?.state === "completed" ? result.count + " observed" :
              result?.state === "already_running" ? "Already running" :
              result?.state === "failed" ? "Failed" : "Not scanned"}
          </span>
          <button type="button" disabled={running.length > 0} onClick={() => start([provider])}
            aria-label={"Scan " + names[provider] + " now"}>Scan</button>
          {result?.message && <small className="scan-message" title={result.message}>{result.message}</small>}
        </div>;
      })}
    </div>
    {running.length > 0 && <p className="scan-footnote" role="status">
      Scanning {running.map(provider => names[provider]).join(", ")}. This can take several minutes; keep this page open.
    </p>}
  </section>;
}
