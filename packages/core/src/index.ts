export type Severity = "info" | "warning" | "critical";
export type AttentionKind = "stale_branch" | "stale_pr" | "failed_workflow";

export type GitBranch = {
  name: string; sha: string; isDefault: boolean; lastCommitAt: string | null; url: string;
};
export type PullRequest = {
  number: number; title: string; url: string; branch: string;
  createdAt: string; updatedAt: string; draft: boolean;
  body?: string | null; author?: string; isBot?: boolean; requestedReviewers?: number;
  reviewStatus?: "approved" | "changes_requested" | "commented" | "none" | "unknown";
  checks?: "success" | "failure" | "pending" | "unknown";
  discussion?: Array<{ author: string; body: string; createdAt: string }>;
};
export type WorkflowRun = {
  id: number; name: string; conclusion: string | null; status: string;
  url: string; createdAt: string; branch: string;
};
export type WorkIssue = { number: number; title: string; url: string; updatedAt: string; labels: string[] };
export type RecentMerge = {
  number: number; title: string; url: string; mergedAt: string; branch: string;
  body?: string | null; isBot?: boolean;
};
export type PlanningTask = { text: string; done: boolean; line: number };
export type PlanningDocument = { path: string; url: string; tasks: PlanningTask[] };

export type ProjectSnapshot = {
  provider: "github"; providerId: string; slug: string; name: string; url: string;
  description: string | null; defaultBranch: string; lastActivityAt: string | null;
  archived: boolean; branches: GitBranch[]; pullRequests: PullRequest[];
  workIssues?: WorkIssue[]; recentMerges?: RecentMerge[]; planningDocuments?: PlanningDocument[];
  openIssues: number; latestWorkflow: WorkflowRun | null; observedAt: string;
};
export type AttentionFinding = {
  key: string; kind: AttentionKind; severity: Severity; title: string;
  explanation: string; evidenceUrl: string; observedAt: string;
};
export type ProjectAssessment = { snapshot: ProjectSnapshot; findings: AttentionFinding[]; summary: string };
export type AssessmentOptions = { now?: Date; staleBranchDays?: number; stalePrDays?: number };

export function daysSince(value: string, now: Date): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now.getTime()) return null;
  return Math.floor((now.getTime() - timestamp) / 86_400_000);
}

export function assessProject(snapshot: ProjectSnapshot, options: AssessmentOptions = {}): ProjectAssessment {
  const now = options.now ?? new Date();
  const staleBranchDays = options.staleBranchDays ?? 14;
  const stalePrDays = options.stalePrDays ?? 14;
  const findings: AttentionFinding[] = [];
  for (const branch of snapshot.branches) {
    if (branch.isDefault || !branch.lastCommitAt) continue;
    const age = daysSince(branch.lastCommitAt, now);
    if (age === null || age < staleBranchDays) continue;
    findings.push({
      key: "stale_branch:" + branch.name, kind: "stale_branch", severity: "warning",
      title: "Review ageing branch: " + branch.name,
      explanation: "The most recent commit is " + age + " days old. Review before deleting; inactivity alone does not prove it is unused.",
      evidenceUrl: branch.url, observedAt: snapshot.observedAt
    });
  }
  for (const pr of snapshot.pullRequests) {
    const age = daysSince(pr.updatedAt, now);
    if (age === null || age < stalePrDays) continue;
    findings.push({
      key: "stale_pr:" + pr.number, kind: "stale_pr", severity: "warning",
      title: "Review PR #" + pr.number + ": " + pr.title,
      explanation: "No PR update for " + age + " days. Check review, CI and merge requirements.",
      evidenceUrl: pr.url, observedAt: snapshot.observedAt
    });
  }
  const workflow = snapshot.latestWorkflow;
  if (workflow && workflow.status === "completed" && ["failure", "timed_out", "action_required"].includes(workflow.conclusion ?? "")) {
    findings.push({
      key: "failed_workflow:" + workflow.id, kind: "failed_workflow", severity: "critical",
      title: "Investigate failed workflow: " + workflow.name,
      explanation: "The latest retrieved workflow run concluded with " + workflow.conclusion + ".",
      evidenceUrl: workflow.url, observedAt: snapshot.observedAt
    });
  }
  const activity = snapshot.lastActivityAt
    ? (daysSince(snapshot.lastActivityAt, now) ?? 0) + " days since latest repository push"
    : "no recent push timestamp available";
  const summary = snapshot.branches.length + " branches, " + snapshot.pullRequests.length +
    " open PRs, " + snapshot.openIssues + " open issues; " + activity + ". " +
    (findings.length ? findings.length + " attention item(s) detected." : "No rule-based alerts detected.");
  return { snapshot, findings, summary };
}

export type SourceAdapter<T> = { name: string; discover(): Promise<T[]> };
export { assessInfrastructure, normaliseGitRepo } from "./infrastructure";
export type {
  InfrastructureResource, InfrastructureFinding, InfrastructureKind,
  InfrastructureProvider, InfrastructureFindingKind
} from "./infrastructure";

export { deriveWorkHandover } from "./work";
export type { WorkHandover, WorkItem, WorkStage } from "./work";

export { parsePullRequestContext } from "./pr-context";
export type { PullRequestContext } from "./pr-context";

export { parseCheckpoint, checkpointNextStep } from "./checkpoint";
export type { CheckpointInput, CheckpointEntry } from "./checkpoint";

export { parseContribution, contributionKinds } from "./contribution";
export type { AgentContributionInput, ContributionKind } from "./contribution";
