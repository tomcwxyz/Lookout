"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const statusLabels: Record<string, string> = {
  exploring: "Exploring", building: "Building", testing: "Testing", live: "Live",
  maintaining: "Maintaining", paused: "Paused", archived: "Archived"
};
async function requestJson(url: string, method: "POST" | "PATCH", payload: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload) });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Request failed");
  }
  return response.json();
}
export function CreateProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await requestJson("/api/portfolio", "POST", { name, description });
      router.push("/portfolio/" + result.id);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create project"); }
    finally { setBusy(false); }
  }
  return <form className="portfolio-form" onSubmit={submit}>
    <label htmlFor="new-project-name">Add a project without a repository</label>
    <div className="portfolio-form-row">
      <input id="new-project-name" required maxLength={120} placeholder="Project name" value={name}
        onChange={e => setName(e.target.value)} />
      <input aria-label="Description" maxLength={2000} placeholder="Short description (optional)"
        value={description} onChange={e => setDescription(e.target.value)} />
      <button disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create project"}</button>
    </div>
    {error && <small role="alert" className="form-error">{error}</small>}
  </form>;
}
export function ConfirmProjectStatus({ id, initialStatus, initialNote }: {
  id: number; initialStatus: string | null; initialNote: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try {
      await requestJson("/api/portfolio/" + id, "PATCH", { status: status || null, note });
      setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save status"); }
    finally { setBusy(false); }
  }
  return <form className="portfolio-form" onSubmit={submit}>
    <label htmlFor="confirmed-status">Human-confirmed project status</label>
    <select id="confirmed-status" value={status} onChange={e => { setStatus(e.target.value); setSaved(false); }}>
      <option value="">Unconfirmed / unknown</option>
      {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
    </select>
    <label htmlFor="status-note">Reason, next decision or context (optional)</label>
    <textarea id="status-note" maxLength={2000} rows={3} value={note}
      onChange={e => { setNote(e.target.value); setSaved(false); }} />
    <div className="portfolio-form-row"><button disabled={busy}>{busy ? "Saving…" : "Save confirmed status"}</button>
      {saved && <span className="muted">Saved · observations won't overwrite this status</span>}</div>
    {error && <small role="alert" className="form-error">{error}</small>}
  </form>;
}
export function AssignRepository({ portfolioId, repositories }: {
  portfolioId: number; repositories: Array<{ providerId: string; slug: string; currentProject: string }>;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await requestJson("/api/portfolio/assign", "POST", {
        repositoryProviderId: selection, portfolioProjectId: portfolioId
      });
      setSelection(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not associate repository"); }
    finally { setBusy(false); }
  }
  return <form className="portfolio-form" onSubmit={submit}>
    <label htmlFor="repo-assignment">Connect an observed repository to this project</label>
    <div className="portfolio-form-row">
      <select id="repo-assignment" required value={selection} onChange={e => setSelection(e.target.value)}>
        <option value="">Choose a repository…</option>
        {repositories.map(r => <option key={r.providerId} value={r.providerId}>
          {r.slug} {r.currentProject ? "(currently " + r.currentProject + ")" : ""}
        </option>)}
      </select>
      <button disabled={!selection || busy}>{busy ? "Linking…" : "Link repository"}</button>
    </div>
    <p className="muted">Moving a repository preserves its GitHub observations, work decisions and agent history. No GitHub changes are made.</p>
    {error && <small role="alert" className="form-error">{error}</small>}
  </form>;
}
