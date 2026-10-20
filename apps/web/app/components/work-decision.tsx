"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const userStatuses = [
  { value: "", label: "Use evidence suggestion" },
  { value: "complete", label: "Complete / accepted" },
  { value: "needs_tidy", label: "Implemented · tidy-up remains" },
  { value: "needs_testing", label: "Needs human testing" },
  { value: "needs_review", label: "Needs human review" },
  { value: "in_progress", label: "Actively in progress" },
  { value: "on_hold", label: "On hold" },
  { value: "scoped_not_built", label: "Scoped, not built" }
];

export function WorkDecisionControl({
  projectId, workKey, initialStatus, initialNote
}: { projectId: number; workKey: string; initialStatus: string | null; initialNote: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const changed = status !== (initialStatus ?? "") || note !== (initialNote ?? "");
  async function save() {
    if (!changed || saving) return;
    setSaving(true); setFeedback("");
    try {
      const response = await fetch("/api/work/decision", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, workKey, status: status || null, note })
      });
      if (!response.ok) {
        setFeedback("Could not save confirmation. Please retry.");
      } else {
        setFeedback("Saved — this won't be overwritten by later scans.");
        router.refresh();
      }
    } catch {
      setFeedback("Network error — decision not saved.");
    } finally { setSaving(false); }
  }
  return <div className="work-decision" onClick={event => event.stopPropagation()}>
    <label>Confirm progress
      <select aria-label={"Confirm status for " + workKey} value={status} onChange={event => setStatus(event.target.value)} disabled={saving}>
        {userStatuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <label>What remains? (optional)
      <input value={note} maxLength={500} placeholder="e.g. Test on Windows, then tidy docs" onChange={event => setNote(event.target.value)} disabled={saving}/>
    </label>
    <button type="button" disabled={saving || !changed} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button>
    {feedback && <small role="status">{feedback}</small>}
  </div>;
}
