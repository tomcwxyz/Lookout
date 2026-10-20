import type { ProjectSnapshot, PlanningDocument } from "./index";

export type WorkStage = "needs_review" | "needs_testing" | "in_progress" | "possibly_paused" | "integrated" | "planned" | "marked_done";
export type WorkItem = {
  key: string; title: string; stage: WorkStage; evidenceType: "pull_request" | "issue" | "plan";
  evidenceUrl: string; explanation: string; updatedAt: string | null;
};
export type WorkHandover = {
  nextStep: string; items: WorkItem[]; plans: PlanningDocument[];
  counts: Record<WorkStage, number>; coverage: string;
};

const priority: WorkStage[] = ["needs_testing", "needs_review", "in_progress", "possibly_paused", "planned", "integrated", "marked_done"];
function testing(labels: string[]): boolean { return labels.some(x => /^(test|testing|qa|needs[-_ ]?testing|verification)$/i.test(x)); }
function review(labels: string[]): boolean { return labels.some(x => /^(review|needs[-_ ]?review|human[-_ ]?review|approval)$/i.test(x)); }
const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);
function time(i: WorkItem) { const t = Date.parse(i.updatedAt ?? ""); return Number.isFinite(t) ? t : 0; }

/** All stages are evidence interpretations. Never infer accepted, live, or unbuilt from a checkbox or merge. */
export function deriveWorkHandover(snapshot: ProjectSnapshot, now = new Date()): WorkHandover {
  const items: WorkItem[] = [];
  for (const pr of snapshot.pullRequests) {
    const days = Math.max(0, (now.getTime() - Date.parse(pr.updatedAt)) / 86_400_000);
    const stage: WorkStage = days >= 21 ? "possibly_paused" : pr.draft ? "in_progress" : "needs_review";
    items.push({ key: "pr:" + pr.number, title: clean(pr.title), stage, evidenceType: "pull_request",
      evidenceUrl: pr.url, updatedAt: pr.updatedAt,
      explanation: stage === "possibly_paused" ? "Open PR not updated for 21+ days; confirm whether to resume."
        : pr.draft ? "Open draft PR: implementation is not yet marked ready for review."
        : "Open PR ready for a human review, testing and merge decision." });
  }
  for (const issue of snapshot.workIssues ?? []) {
    const stage: WorkStage = testing(issue.labels) ? "needs_testing" : review(issue.labels) ? "needs_review" : "planned";
    items.push({ key: "issue:" + issue.number, title: clean(issue.title), stage, evidenceType: "issue",
      evidenceUrl: issue.url, updatedAt: issue.updatedAt,
      explanation: stage === "planned" ? "Open issue or proposal; work might already be partially implemented."
        : "Open issue explicitly labelled for " + (stage === "needs_testing" ? "testing." : "review.") });
  }
  for (const merge of snapshot.recentMerges ?? []) {
    items.push({ key: "merge:" + merge.number, title: clean(merge.title), stage: "integrated",
      evidenceType: "pull_request", evidenceUrl: merge.url, updatedAt: merge.mergedAt,
      explanation: "Merged into Git; production release, acceptance and tidy-up remain unverified." });
  }
  for (const document of snapshot.planningDocuments ?? []) {
    for (const task of document.tasks.slice(0, 12)) {
      items.push({ key: "plan:" + document.path + ":" + task.line,
        title: clean(task.text), stage: task.done ? "marked_done" : "planned",
        evidenceType: "plan", evidenceUrl: document.url + "#L" + task.line,
        updatedAt: null, explanation: task.done
          ? "Checked off in " + document.path + ", not independently verified."
          : "Unchecked task in " + document.path + "; document could be out of date." });
    }
  }
  const counts = Object.fromEntries(priority.map(s => [s, 0])) as Record<WorkStage, number>;
  for (const item of items) counts[item.stage]++;
  items.sort((a, b) => priority.indexOf(a.stage) - priority.indexOf(b.stage) || time(b) - time(a));
  const next = items.find(x => priority.indexOf(x.stage) <= 1)
    ?? items.find(x => ["in_progress", "possibly_paused"].includes(x.stage))
    ?? items.find(x => x.stage === "planned") ?? items.find(x => x.stage === "integrated");
  const verb = next?.stage === "integrated" ? "Verify acceptance or release: "
    : next?.stage === "planned" ? "Clarify scope: "
    : next?.stage === "possibly_paused" ? "Resume or close: "
    : next?.stage === "in_progress" ? "Continue work on: " : "Review: ";
  return {
    nextStep: next ? verb + next.title : "No recent work could be identified from the available evidence.",
    items, plans: snapshot.planningDocuments ?? [], counts,
    coverage: snapshot.planningDocuments === undefined ? "Plans not scanned."
      : snapshot.planningDocuments.length ? "Selected plans inspected, not an exhaustive inventory."
      : "No plan file found in the checked locations."
  };
}
