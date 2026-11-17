/**
 * Version 2 handover contract. This is a report about work, never a human
 * acceptance decision and never proof that a test or deployment succeeded.
 */
export type SessionHandover = {
  eventId: string; agent: string; title: string; aim: string; summary: string;
  workstream: string; next: string; done: string[]; notDone: string[];
  decisions: string[]; blockers: string[]; addresses: string[];
  basedOnRevision: number | null; branch?: string; commitSha?: string; prUrl?: string;
};
export type HandoverReconciliation = {
  status: "incorporated" | "needs_review";
  previousRevision: number; basedOnRevision: number | null;
  staleContext: boolean; reason: string;
  proposedClosures: string[]; evidence: "pr_observed" | "pr_not_observed" | "not_checked";
  trust: "agent_reported";
};
const eventIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,119}$/;
const shaPattern = /^[0-9a-f]{7,64}$/i;
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected handover object");
  return v as Record<string, unknown>;
}
function required(v: unknown, field: string, limit: number): string {
  if (typeof v !== "string" || !v.trim() || v.length > limit)
    throw new Error("Invalid " + field);
  return v.trim();
}
function optional(v: unknown, field: string, limit: number): string | undefined {
  return v == null || v === "" ? undefined : required(v, field, limit);
}
function strings(v: unknown, field: string, count: number): string[] {
  if (!Array.isArray(v) || v.length > count) throw new Error("Invalid " + field);
  return v.map(item => required(item, field + " item", 300));
}
export function parseSessionHandover(raw: unknown): SessionHandover {
  const v = object(raw);
  const eventId = required(v.eventId, "eventId", 120);
  if (!eventIdPattern.test(eventId)) throw new Error("Invalid eventId");
  const branch = optional(v.branch, "branch", 200);
  const commitSha = optional(v.commitSha, "commitSha", 64);
  if (commitSha && !shaPattern.test(commitSha)) throw new Error("Invalid commitSha");
  const prUrl = optional(v.prUrl, "prUrl", 500);
  if (prUrl && !/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+\/pull\/\d+(?:[?#].*)?$/.test(prUrl))
    throw new Error("Invalid prUrl");
  const basedOnRevision = v.basedOnRevision == null ? null : v.basedOnRevision;
  if (basedOnRevision !== null && (!Number.isSafeInteger(basedOnRevision) || (basedOnRevision as number) < 0))
    throw new Error("Invalid basedOnRevision");
  const addresses = strings(v.addresses ?? [], "addresses", 10);
  if (addresses.some(id => !eventIdPattern.test(id))) throw new Error("Invalid addressed event");
  return {
    eventId, agent: required(v.agent, "agent", 80),
    title: required(v.title, "title", 180), aim: required(v.aim, "aim", 1000),
    summary: required(v.summary, "summary", 2500),
    workstream: optional(v.workstream, "workstream", 120) ?? "general",
    next: required(v.next, "next", 300),
    done: strings(v.done, "done", 12), notDone: strings(v.notDone, "notDone", 12),
    decisions: strings(v.decisions, "decisions", 10),
    blockers: strings(v.blockers, "blockers", 10), addresses,
    basedOnRevision: basedOnRevision as number | null,
    ...(branch ? {branch} : {}), ...(commitSha ? {commitSha} : {}),
    ...(prUrl ? {prUrl} : {})
  };
}
/** Deterministic consistency gate; independent verification happens elsewhere. */
export function reconcileSession(
  report: SessionHandover, revision: number,
  evidence: HandoverReconciliation["evidence"] = "not_checked"
): HandoverReconciliation {
  const staleContext = report.basedOnRevision !== revision;
  return {
    status: staleContext ? "needs_review" : "incorporated",
    previousRevision: revision, basedOnRevision: report.basedOnRevision,
    staleContext,
    reason: report.basedOnRevision === null
      ? "No previous Lookout revision was supplied; the report is retained for review."
      : staleContext
        ? "Lookout changed since this agent read it; review concurrent work before incorporation."
        : "Incorporated as an attributed, unverified report; no completion was automatically confirmed.",
    proposedClosures: [...report.addresses],
    evidence, trust: "agent_reported"
  };
}
