"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LinkForm({ resourceKey, projectId, projects }: {
  resourceKey: string;
  projectId: number | null;
  projects: Array<{ id: number; name: string; slug: string }>;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState(projectId ? String(projectId) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/resources/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceKey, projectId: selection ? Number(selection) : null })
      });
      if (!response.ok) throw new Error("Could not update the resource link");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unexpected error"); }
    finally { setSaving(false); }
  }
  return <div className="link-form"><label htmlFor={"resource-" + resourceKey}>Associate with repository</label>
    <div><select id={"resource-" + resourceKey} value={selection} onChange={e => setSelection(e.target.value)}>
      <option value="">Unlinked / exclude auto-link</option>
      {projects.map(p => <option value={p.id} key={p.id}>{p.slug}</option>)}
    </select><button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
    {error && <small role="alert" className="form-error">{error}</small>}
  </div>;
}
