import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

export type WorkspaceReport = {
 id:string;portfolioId:number;projectName:string;source:"agent"|"chatgpt";
 agent:string;kind:string;title:string;summary:string;nextStep:string;
 recordedAt:string;blockerCount:number;remainingCount:number;verified:false;
};

/** One bounded, tenant-filtered query instead of 2 calls per project. */
export async function listWorkspaceReports(organisationId:number,limit=50):Promise<WorkspaceReport[]> {
 if(!Number.isSafeInteger(organisationId)||organisationId<=0)return [];
 const bounded=Math.max(1,Math.min(100,Math.trunc(limit)));
 const result=await getDatabase().execute(sql`
 SELECT id,portfolio_id,project_name,source,agent,kind,title,summary,next_step,blocker_count,remaining_count,recorded_at
 FROM (
  SELECT ('agent-'||c.id::text) id,c.portfolio_project_id portfolio_id,p.name project_name,
    'agent' source,c.agent,c.kind,c.title,COALESCE(c.payload->>'summary','') summary,
    COALESCE(NULLIF(c.payload->'remaining'->>0,''),'Review the agent handover') next_step,
    jsonb_array_length(COALESCE(c.payload->'blockers','[]'::jsonb)) blocker_count,
    jsonb_array_length(COALESCE(c.payload->'remaining','[]'::jsonb)) remaining_count,
    c.recorded_at
  FROM agent_contributions c
  JOIN lookout_project_access a ON a.portfolio_project_id=c.portfolio_project_id
  JOIN portfolio_projects p ON p.id=c.portfolio_project_id
  WHERE a.organisation_id=${organisationId}
  UNION ALL
  SELECT ('chatgpt-'||c.id::text) id,c.portfolio_project_id portfolio_id,p.name project_name,
    'chatgpt' source,'ChatGPT' agent,c.kind,COALESCE(c.payload->>'title','ChatGPT contribution') title,
    COALESCE(c.payload->>'summary','') summary,
    COALESCE(NULLIF(c.payload->'remaining'->>0,''),'Review the ChatGPT report') next_step,
    jsonb_array_length(COALESCE(c.payload->'blockers','[]'::jsonb)) blocker_count,
    jsonb_array_length(COALESCE(c.payload->'remaining','[]'::jsonb)) remaining_count,
    c.recorded_at
  FROM chatgpt_contributions c
  JOIN lookout_project_access a ON a.portfolio_project_id=c.portfolio_project_id
  JOIN portfolio_projects p ON p.id=c.portfolio_project_id
  WHERE a.organisation_id=${organisationId}
 ) a ORDER BY recorded_at DESC LIMIT ${bounded}
 `);
 return result.map(row=>({
  id:String(row.id),portfolioId:Number(row.portfolio_id),projectName:String(row.project_name),
  source:String(row.source)==="agent"?"agent":"chatgpt",
  agent:String(row.agent),kind:String(row.kind),title:String(row.title),
  summary:String(row.summary),nextStep:String(row.next_step),
  recordedAt:new Date(String(row.recorded_at)).toISOString(),blockerCount:Number(row.blocker_count),remainingCount:Number(row.remaining_count),verified:false as const
 }));
}

/** Observation freshness and coverage are informational, never automatic verification. */
export async function getWorkspaceSourceSummary(organisationId:number) {
 if(!Number.isSafeInteger(organisationId)||organisationId<=0)return null;
 const rows=await getDatabase().execute(sql`
 SELECT
  (SELECT COUNT(DISTINCT l.repository_provider_id)::int FROM lookout_project_access a
    JOIN portfolio_repository_links l ON l.portfolio_project_id=a.portfolio_project_id
    WHERE a.organisation_id=${organisationId}) AS repositories,
  (SELECT COUNT(DISTINCT f.id)::int FROM lookout_project_access a
    JOIN portfolio_repository_links l ON l.portfolio_project_id=a.portfolio_project_id
    JOIN projects p ON p.provider_id=l.repository_provider_id
    JOIN attention_items f ON f.project_id=p.id AND f.status='open'
    WHERE a.organisation_id=${organisationId}) AS open_findings,
  (SELECT COUNT(DISTINCT r.id)::int FROM lookout_project_access a
    JOIN portfolio_repository_links l ON l.portfolio_project_id=a.portfolio_project_id
    JOIN projects p ON p.provider_id=l.repository_provider_id
    JOIN infrastructure_resources r ON r.project_id=p.id
    WHERE a.organisation_id=${organisationId}) AS linked_resources,
  (SELECT MAX(finished_at) FROM sync_runs WHERE status='completed') AS github_sync,
  (SELECT MAX(started_at) FROM source_sync_runs WHERE provider='neon' AND status='completed') AS neon_sync,
  (SELECT MAX(started_at) FROM source_sync_runs WHERE provider='vercel' AND status='completed') AS vercel_sync
 `);
 const row=rows[0];if(!row)return null;
 const time=(v:unknown)=>v==null?null:new Date(String(v)).toISOString();
 return {repositories:Number(row.repositories),openFindings:Number(row.open_findings),
  linkedResources:Number(row.linked_resources),githubSync:time(row.github_sync),
  neonSync:time(row.neon_sync),vercelSync:time(row.vercel_sync)};
}

/** One provisional current position per authorised project, not one card per handover.
 * Existing v1 notes remain visible during the transition; stale v2 submissions
 * never replace the current incorporated position.
 */
export async function listWorkspacePositions(organisationId:number,limit=12) {
 if(!Number.isSafeInteger(organisationId)||organisationId<1)return [];
 const max=Math.max(1,Math.min(30,Math.trunc(limit)));
 const rows=await getDatabase().execute(sql`
 SELECT p.id project_id,p.name project_name,
   CASE WHEN v2.recorded_at >= COALESCE(old.recorded_at,'epoch'::timestamptz)
     THEN v2.payload ELSE old.payload END payload,
   CASE WHEN v2.recorded_at >= COALESCE(old.recorded_at,'epoch'::timestamptz)
     THEN v2.recorded_at ELSE old.recorded_at END recorded_at,
   CASE WHEN v2.recorded_at >= COALESCE(old.recorded_at,'epoch'::timestamptz)
     THEN true ELSE false END reconciled,
   COALESCE(v2.revision,0) revision,
   (SELECT COUNT(*)::int FROM lookout_handover_sessions h
     WHERE h.portfolio_project_id=p.id
       AND h.reconciliation->>'status'='needs_review') review_count
 FROM lookout_project_access a
 JOIN portfolio_projects p ON p.id=a.portfolio_project_id
 LEFT JOIN LATERAL (
   SELECT payload,recorded_at,revision FROM lookout_handover_sessions h
   WHERE h.portfolio_project_id=p.id
     AND h.reconciliation->>'status'='incorporated'
   ORDER BY revision DESC LIMIT 1
 ) v2 ON true
 LEFT JOIN LATERAL (
   SELECT payload,recorded_at FROM (
     SELECT c.payload,c.recorded_at FROM agent_contributions c WHERE c.portfolio_project_id=p.id
     UNION ALL SELECT c.payload,c.recorded_at FROM chatgpt_contributions c
       WHERE c.portfolio_project_id=p.id
   ) earlier ORDER BY recorded_at DESC LIMIT 1
 ) old ON true
 WHERE a.organisation_id=${organisationId}
   AND (v2.recorded_at IS NOT NULL OR old.recorded_at IS NOT NULL)
 ORDER BY recorded_at DESC LIMIT ${max}
 `);
 return rows.map(row=>{
  const payload=row.payload as Record<string,unknown>;
  const strings=(key:string)=>Array.isArray(payload[key])?
    (payload[key] as unknown[]).filter((v):v is string=>typeof v==="string"):[];
  return {
   projectId:Number(row.project_id),projectName:String(row.project_name),
   title:String(payload.title??"Project handover"),summary:String(payload.summary??""),
   next:String(payload.next??strings("blockers")[0]??strings("remaining")[0]??strings("notDone")[0]??"Review the project context"),
   at:new Date(String(row.recorded_at)).toISOString(),
   reconciled:Boolean(row.reconciled),revision:Number(row.revision),
   reviewCount:Number(row.review_count)
  };
 });
}
