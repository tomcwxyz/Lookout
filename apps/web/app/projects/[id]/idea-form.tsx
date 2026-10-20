"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IdeaForm({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title })
      });
      if (!response.ok) throw new Error("Could not save idea");
      setTitle("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={submit} className="idea-form">
    <label htmlFor="idea-title">Quick capture</label>
    <div className="idea-input-row"><input id="idea-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={240} required placeholder="Something worth exploring…" /><button type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Add idea"}</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
