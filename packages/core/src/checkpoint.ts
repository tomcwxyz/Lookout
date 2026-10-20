/** Versioned, portable agent checkpoint contract shared by API and MCP clients.
 * Agent statements are ALWAYS self-reported, not observed acceptance.
 */
export type CheckpointInput = {
  version: 1;
  eventId: string;
  agent: string;
  title: string;
  objective: string;
  summary: string;
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  implemented: string[];
  remaining: string[];
  tests: Array<{ description: string; result: "passed_claimed" | "failed_claimed" | "not_run" | "needs_human" }>;
  decisions: string[];
  blockers: string[];
  capturedAt?: string;
};
export type CheckpointEntry = CheckpointInput & {
  id: number; projectId: number; recordedAt: string; trust: "agent_reported"; status: "proposed";
};

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,119}$/;
const shaPattern = /^[a-fA-F0-9]{7,64}$/;
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected checkpoint object");
  return v as Record<string, unknown>;
}
function string(v: unknown, name: string, max: number, required = false): string | undefined {
  if (v === undefined && !required) return undefined;
  if (typeof v !== "string" || (required && !v.trim()) || v.length > max) {
    throw new Error("Invalid " + name + " (max " + max + " characters)");
  }
  return v.trim();
}
function list(v: unknown, name: string, maxItems: number, maxLen = 300): string[] {
  if (!Array.isArray(v) || v.length > maxItems) throw new Error("Invalid " + name);
  return v.map(x => string(x, name + " item", maxLen, true)!);
}
export function parseCheckpoint(value: unknown): CheckpointInput {
  const v = obj(value);
  if (v.version !== 1) throw new Error("Unsupported checkpoint version");
  const eventId = string(v.eventId, "eventId", 120, true)!;
  if (!idPattern.test(eventId)) throw new Error("eventId must be a stable non-secret ID");
  const commitSha = string(v.commitSha, "commitSha", 64);
  if (commitSha && !shaPattern.test(commitSha)) throw new Error("Invalid commit SHA");
  const prUrl = string(v.prUrl, "prUrl", 500);
  if (prUrl && (!/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+\/pull\/\d+(?:[/?#].*)?$/.test(prUrl))) {
    throw new Error("PR URL must be an HTTPS GitHub pull-request link");
  }
  if (!Array.isArray(v.tests) || v.tests.length > 12) throw new Error("Invalid test claims");
  const valid = ["passed_claimed","failed_claimed","not_run","needs_human"] as const;
  const tests = v.tests.map(x => {
    const row = obj(x);
    if (!valid.includes(row.result as typeof valid[number])) throw new Error("Invalid test result");
    return { description: string(row.description, "test description", 300, true)!,
      result: row.result as typeof valid[number] };
  });
  const capturedAt = string(v.capturedAt, "capturedAt", 50);
  if (capturedAt && (!Number.isFinite(Date.parse(capturedAt)) || !/^\d{4}-\d{2}-\d{2}T/.test(capturedAt))) {
    throw new Error("Invalid capturedAt");
  }
  return {
    version: 1, eventId, agent: string(v.agent,"agent",80,true)!,
    title: string(v.title,"title",180,true)!,
    objective: string(v.objective,"objective",1000,true)!,
    summary: string(v.summary,"summary",2500,true)!,
    ...(string(v.branch,"branch",200) ? {branch:string(v.branch,"branch",200)} : {}),
    ...(commitSha ? { commitSha } : {}), ...(prUrl ? { prUrl } : {}),
    implemented: list(v.implemented, "implemented", 12),
    remaining: list(v.remaining, "remaining", 12),
    tests, decisions: list(v.decisions, "decisions", 10),
    blockers: list(v.blockers, "blockers", 10),
    ...(capturedAt ? { capturedAt } : {})
  };
}
/** Human-friendly checkpoint selection; never reports a completion decision. */
export function checkpointNextStep(c: CheckpointInput): string {
  return c.blockers[0] ?? c.remaining[0] ??
    c.tests.find(t => t.result === "needs_human")?.description ??
    "Review the agent's claims against repository and test evidence.";
}
