import type { ProjectSnapshot, PlanningDocument } from "./index";
import { parsePullRequestContext, type PullRequestContext } from "./pr-context";

export type WorkStage = "checks_failing" | "changes_requested" | "needs_review" | "needs_testing" | "review_approved" | "awaiting_decision" | "maintenance" | "in_progress" | "possibly_paused" | "integrated" | "planned" | "marked_done";
export type WorkItem = {
  key: string; title: string; stage: WorkStage; evidenceType: "pull_request" | "issue" | "plan";
  evidenceUrl: string; explanation: string; updatedAt: string | null;
  summary?: string | null; nextAction?: string; context?: PullRequestContext;
  checks?: "success" | "failure" | "pending" | "unknown";
  reviewStatus?: "approved" | "changes_requested" | "commented" | "none" | "unknown";
};
export type WorkHandover = {
  nextStep: string; items: WorkItem[]; plans: PlanningDocument[];
  counts: Record<WorkStage, number>; coverage: string;
};

const priority: WorkStage[] = ["checks_failing", "changes_requested", "needs_testing", "needs_review", "review_approved", "in_progress", "possibly_paused", "awaiting_decision", "planned", "integrated", "marked_done", "maintenance"];
function testing(labels: string[]): boolean { return labels.some(x => /^(test|testing|qa|needs[-_ ]?testing|verification)$/i.test(x)); }
function review(labels: string[]): boolean { return labels.some(x => /^(review|needs[-_ ]?review|human[-_ ]?review|approval)$/i.test(x)); }
const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);
function time(i: WorkItem) { const t = Date.parse(i.updatedAt ?? ""); return Number.isFinite(t) ? t : 0; }

/** All stages are evidence interpretations. Never infer accepted, live, or unbuilt from a checkbox or merge. */
export function deriveWorkHandover(snapshot: ProjectSnapshot, now = new Date()): WorkHandover {
  const items: WorkItem[] = [];
  for (const pr of snapshot.pullRequests) {
    const context = parsePullRequestContext(pr.body, pr.discussion);
    const days = Math.max(0, (now.getTime() - Date.parse(pr.updatedAt)) / 86_400_000);
    const testingRemains = context.remaining.some(task => /\b(test|qa|verify|validation|smoke|acceptance|review on|check on)\b/i.test(task));
    const stage: WorkStage = pr.isBot ? "maintenance"
      : pr.reviewStatus === "changes_requested" ? "changes_requested"
      : pr.checks === "failure" ? "checks_failing"
      : pr.draft ? "in_progress"
      : testingRemains ? "needs_testing"
      : days >= 21 ? "possibly_paused"
      : pr.reviewStatus === "approved" ? "review_approved"
      : (pr.requestedReviewers ?? 0) > 0 ? "needs_review"
      : "awaiting_decision";
    const rationale: Record<WorkStage, string> = {
      checks_failing: "Checks were reported failing when observed; investigate before merging.",
      changes_requested: "At least one current reviewer has requested changes.",
      needs_testing: "The PR author left an explicit testing or verification task unchecked.",
      needs_review: "The PR has an outstanding requested reviewer.",
      review_approved: "At least one reviewer approved; approval does not establish merge readiness.",
      in_progress: "Open draft PR; the author has not marked it ready for review.",
      possibly_paused: "Open PR has not been updated in 21+ days; confirm whether to resume.",
      awaiting_decision: "PR is open; review or next action has not been established from available metadata.",
      maintenance: "Bot-authored maintenance change; prioritise separately from feature delivery.",
      planned: "", integrated: "", marked_done: ""
    };
    const nextAction = context.remaining[0] ?? (
      stage === "changes_requested" ? "Address the review feedback."
      : stage === "checks_failing" ? "Investigate the failing checks."
      : stage === "needs_review" ? "Review the requested changes."
      : stage === "review_approved" ? "Verify remaining checks and decide whether to merge."
      : stage === "in_progress" ? "Continue implementing the draft."
      : stage === "needs_testing" ? "Complete the stated testing."
      : stage === "maintenance" ? "Assess whether the dependency update is needed."
      : "Confirm what remains and decide the next action."
    );
    items.push({
      key: "pr:" + pr.number, title: clean(pr.title), stage,
      evidenceType: "pull_request", evidenceUrl: pr.url, updatedAt: pr.updatedAt,
      explanation: rationale[stage], summary: context.summary ?? context.changes[0] ?? null,
      nextAction, context, checks: pr.checks, reviewStatus: pr.reviewStatus
    });
  }
  for (const issue of snapshot.workIssues ?? []) {
    const stage: WorkStage = testing(issue.labels) ? "needs_testing" : review(issue.labels) ? "needs_review" : "planned";
    items.push({ key: "issue:" + issue.number, title: clean(issue.title), stage, evidenceType: "issue",
      evidenceUrl: issue.url, updatedAt: issue.updatedAt,
      explanation: stage === "planned" ? "Open issue or proposal; work might already be partially implemented."
        : "Open issue explicitly labelled for " + (stage === "needs_testing" ? "testing." : "review.") });
  }
  for (const merge of snapshot.recentMerges ?? []) {
    const context = parsePullRequestContext(merge.body);
    items.push({ key: "merge:" + merge.number, title: clean(merge.title), stage: merge.isBot ? "maintenance" : "integrated",
      evidenceType: "pull_request", evidenceUrl: merge.url, updatedAt: merge.mergedAt,
      explanation: "Merged into Git; production release, acceptance and tidy-up remain unverified.",
      context, summary: context.summary ?? context.changes[0] ?? null,
      nextAction: context.remaining[0] ?? "Check deployment, acceptance and any follow-up work." });
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
  const next = items.find(x => !["maintenance", "marked_done", "integrated"].includes(x.stage))
    ?? items.find(x => x.stage === "integrated");
  const verb = next?.stage === "integrated" ? "Verify acceptance or release: "
    : next?.stage === "planned" ? "Clarify scope: "
    : next?.stage === "possibly_paused" ? "Resume or close: "
    : next?.stage === "in_progress" ? "Continue work on: " : "Review: ";
  return {
    nextStep: next ? (next.nextAction ?? verb + next.title) : "No recent work could be identified from the available evidence.",
    items, plans: snapshot.planningDocuments ?? [], counts,
    coverage: snapshot.planningDocuments === undefined ? "Plans not scanned."
      : snapshot.planningDocuments.length ? "Selected plans inspected, not an exhaustive inventory."
      : "No plan file found in the checked locations."
  };
}
