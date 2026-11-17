import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { parseSessionHandover, reconcileSession, type SessionHandover } from "@lookout/core";
import { getDatabase } from "./client";

/** A session's revision is assigned under a transaction-scoped project advisory lock.
 * Legacy contributions remain append-only and available as earlier context.
 */
export class HandoverEventConflictError extends Error {
  constructor() { super("Event ID already used for different handover content"); }
}
type Source = "agent" | "chatgpt";
const serialise = (v: unknown) => JSON.stringify(v);
const asDate = (v: unknown) => new Date(String(v)).toISOString();
const toNumber = (v: unknown) => Number(v);
const safeProject = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid project ID");
};

/** Call only AFTER the MCP bearer/owner or organisation grant has been verified. */
export async function getSharedHandoverContext(portfolioId: number, observedProjectId?: number) {
  safeProject(portfolioId);
  if (observedProjectId !== undefined) safeProject(observedProjectId);
  const db = getDatabase();
  const [project, repositories, decisions, history, legacy, latest] = await Promise.all([
    db.execute(sql`
      SELECT id,name,status,status_note,status_confirmed_at
      FROM portfolio_projects WHERE id=${portfolioId} LIMIT 1`),
    db.execute(sql`
      SELECT p.id,p.name,p.slug,p.observed_at,p.snapshot
      FROM portfolio_repository_links l
      JOIN projects p ON p.provider_id=l.repository_provider_id
      WHERE l.portfolio_project_id=${portfolioId}
        AND (${observedProjectId ?? 0}=0 OR p.id=${observedProjectId})
      ORDER BY p.id LIMIT 12`),
    db.execute(sql`
      SELECT p.slug,d.work_key,d.status,d.note,d.updated_at
      FROM portfolio_repository_links l
      JOIN projects p ON p.provider_id=l.repository_provider_id
      JOIN work_decisions d ON d.project_id=p.id
      WHERE l.portfolio_project_id=${portfolioId}
        AND (${observedProjectId ?? 0}=0 OR p.id=${observedProjectId})
      ORDER BY d.updated_at DESC LIMIT 40`),
    db.execute(sql`
      SELECT event_id,revision,source,actor,workstream,payload,reconciliation,recorded_at
      FROM lookout_handover_sessions WHERE portfolio_project_id=${portfolioId}
      ORDER BY revision DESC LIMIT 40`),
    db.execute(sql`
      SELECT source,event_id,kind,payload,recorded_at FROM (
        SELECT 'agent' source,c.event_id,c.kind,c.payload,c.recorded_at
        FROM agent_contributions c
        WHERE c.portfolio_project_id=${portfolioId}
          AND (${observedProjectId ?? 0}=0 OR c.observed_project_id=${observedProjectId})
        UNION ALL
        SELECT 'chatgpt' source,c.event_id,c.kind,c.payload,c.recorded_at
        FROM chatgpt_contributions c WHERE c.portfolio_project_id=${portfolioId}
      ) reports ORDER BY recorded_at DESC LIMIT 30`),
    db.execute(sql`
      SELECT COALESCE(MAX(revision),0)::int AS revision
      FROM lookout_handover_sessions WHERE portfolio_project_id=${portfolioId}`)
  ]);
  if (!project.length) return null;
  if (observedProjectId !== undefined && !repositories.some(r => Number(r.id) === observedProjectId))
    return null;

  const currentByStream = new Map<string, object>();
  const needsReview: object[] = [];
  for (const row of history) {
    const position = {
      eventId: String(row.event_id), revision: toNumber(row.revision),
      agent: String(row.actor), source: String(row.source),
      workstream: String(row.workstream), reported: row.payload,
      recordedAt: asDate(row.recorded_at), reconciliation: row.reconciliation
    };
    const state = (row.reconciliation as {status?:string})?.status;
    if (state === "needs_review") needsReview.push(position);
    if (state === "incorporated" && !currentByStream.has(String(row.workstream)))
      currentByStream.set(String(row.workstream), position);
  }
  const current = [...currentByStream.values()];
  return {
    project: {
      portfolioId, name: String(project[0].name),
      confirmedStatus: project[0].status ?? null,
      confirmedStatusNote: project[0].status_note ?? null,
      statusSource: project[0].status ? "human_confirmed" : "unconfirmed"
    },
    revision: toNumber(latest[0]?.revision ?? 0),
    current, needsReview: needsReview.slice(0, 12),
    repositories: repositories.map(row => {
      const s = row.snapshot as {
        pullRequests?:Array<{number:number;title:string;url:string;branch:string;checks?:string;draft:boolean}>;
        latestWorkflow?:{name:string;branch:string;status:string;conclusion:string|null;url:string};
        lastActivityAt?:string|null;
      };
      return {
        observedProjectId: toNumber(row.id), name: String(row.name), slug: String(row.slug),
        observedAt: asDate(row.observed_at), lastActivityAt: s.lastActivityAt ?? null,
        openPullRequests: (s.pullRequests ?? []).slice(0, 15).map(pr => ({
          number:pr.number,title:pr.title,url:pr.url,branch:pr.branch,
          checks:pr.checks ?? "unknown",draft:pr.draft
        })),
        latestWorkflow: s.latestWorkflow ?? null
      };
    }),
    humanDecisions: decisions.map(row => ({
      repository: String(row.slug), workKey: String(row.work_key),
      status: String(row.status), note: row.note ?? null, at: asDate(row.updated_at)
    })),
    earlierReports: legacy.map(row => ({
      source: String(row.source), eventId: String(row.event_id),
      kind: String(row.kind), payload: row.payload, recordedAt: asDate(row.recorded_at),
      trust: "agent_reported" as const
    })),
    recentSessions: history.slice(0, 15).map(row => ({
      eventId:String(row.event_id),revision:toNumber(row.revision),
      source:String(row.source),agent:String(row.actor),workstream:String(row.workstream),
      payload:row.payload,reconciliation:row.reconciliation,recordedAt:asDate(row.recorded_at)
    })),
    guidance: "Read this state before work. Report with basedOnRevision. The current positions are attributed reports, not verified completion. Human-confirmed decisions are never overwritten."
  };
}

export async function submitReconciledHandover(
  portfolioId: number, source: Source, actor: string, raw: unknown
) {
  safeProject(portfolioId);
  const report = parseSessionHandover(raw);
  if (!actor || actor.length > 160) throw new Error("Invalid agent identity");
  const payload = serialise(report);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s]+@|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{30,}|lkp_[a-f0-9]{40,})/i.test(payload))
    throw new Error("Handover appears to contain a credential");
  const hash = createHash("sha256").update(source + ":" + payload).digest("hex");
  const db = getDatabase();
  return db.transaction(async tx => {
    // Serialises simultaneous agents writing to the SAME project, not the whole portfolio.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72014,${portfolioId})`);
    const valid = await tx.execute(sql`SELECT id FROM portfolio_projects WHERE id=${portfolioId} LIMIT 1`);
    if (!valid.length) throw new Error("Project not found");
    const existing = await tx.execute(sql`
      SELECT id,revision,payload_hash,reconciliation FROM lookout_handover_sessions
      WHERE portfolio_project_id=${portfolioId} AND event_id=${report.eventId} LIMIT 1`);
    if (existing.length) {
      if (String(existing[0].payload_hash) !== hash) throw new HandoverEventConflictError();
      return {id:toNumber(existing[0].id),revision:toNumber(existing[0].revision),
        duplicate:true,reconciliation:existing[0].reconciliation};
    }
    const previous = await tx.execute(sql`
      SELECT COALESCE(MAX(revision),0)::int revision FROM lookout_handover_sessions
      WHERE portfolio_project_id=${portfolioId}`);
    const revision = toNumber(previous[0]?.revision ?? 0);
    const linkedPr = report.prUrl ? await tx.execute(sql`
      SELECT p.id FROM portfolio_repository_links l JOIN projects p
        ON p.provider_id=l.repository_provider_id
      WHERE l.portfolio_project_id=${portfolioId}
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(p.snapshot->'pullRequests','[]'::jsonb)) pr
          WHERE pr->>'url'=${report.prUrl}
        ) LIMIT 1`) : [];
    const evidence = report.prUrl
      ? linkedPr.length ? "pr_observed" : "pr_not_observed" : "not_checked";
    // Compare only the same named workstream. A missing blocker is not proof of resolution.
    const earlierV2=await tx.execute(sql`
      SELECT event_id,payload FROM lookout_handover_sessions
      WHERE portfolio_project_id=${portfolioId} AND workstream=${report.workstream}
        AND reconciliation->>'status'='incorporated'
      ORDER BY revision DESC LIMIT 1`);
    const earlierLegacy=earlierV2.length?[]:await tx.execute(sql`
      SELECT event_id,payload FROM (
        SELECT event_id,payload,recorded_at FROM agent_contributions
          WHERE portfolio_project_id=${portfolioId}
        UNION ALL
        SELECT event_id,payload,recorded_at FROM chatgpt_contributions
          WHERE portfolio_project_id=${portfolioId}
      ) old
      WHERE
        (${report.prUrl ?? ""}<>'' AND payload->>'prUrl'=${report.prUrl ?? ""})
        OR (${report.branch ?? ""}<>'' AND payload->>'branch'=${report.branch ?? ""})
        OR (${report.workstream}='general' AND ${report.prUrl ?? ""}=''
          AND ${report.branch ?? ""}='')
      ORDER BY recorded_at DESC LIMIT 1`);
    const prior=earlierV2[0]??earlierLegacy[0];
    const before=prior?.payload as {blockers?:unknown}|undefined;
    const oldBlockers=Array.isArray(before?.blockers)?
      before.blockers.filter((v:unknown):v is string=>typeof v==="string"):[];
    const reconciliation = reconcileSession(report,revision,evidence,
      prior?{eventId:String(prior.event_id),blockers:oldBlockers}:undefined);
    const inserted = await tx.execute(sql`
      INSERT INTO lookout_handover_sessions
       (portfolio_project_id,event_id,source,actor,workstream,revision,based_on_revision,
        payload,payload_hash,reconciliation)
      VALUES (${portfolioId},${report.eventId},${source},${actor},${report.workstream},
        ${revision+1},${report.basedOnRevision},${payload}::jsonb,${hash},
        ${serialise(reconciliation)}::jsonb)
      RETURNING id`);
    return {id:toNumber(inserted[0].id),revision:revision+1,duplicate:false,
      reconciliation};
  });
}

/** Scoped caller must authorise the project before requesting a receipt. */
export async function getHandoverReconciliation(portfolioId: number, eventId: string) {
  safeProject(portfolioId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{5,119}$/.test(eventId))
    throw new Error("Invalid event ID");
  const rows = await getDatabase().execute(sql`
    SELECT event_id,revision,source,actor,workstream,reconciliation,recorded_at
    FROM lookout_handover_sessions
    WHERE portfolio_project_id=${portfolioId} AND event_id=${eventId} LIMIT 1`);
  if (!rows.length) return null;
  const row = rows[0];
  return {eventId:String(row.event_id),revision:toNumber(row.revision),
    source:String(row.source),agent:String(row.actor),workstream:String(row.workstream),
    reconciliation:row.reconciliation,recordedAt:asDate(row.recorded_at)};
}
