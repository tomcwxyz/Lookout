import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

/** All data in this view is selected through the organisation's explicit project grants. */
export async function getTenantLookoutOverview(organisationId: number) {
 if (!Number.isSafeInteger(organisationId) || organisationId < 1) return { projects:[], recentActivity:[] };
 const db=getDatabase();
 const [projects,activity]=await Promise.all([
  db.execute(sql`
   SELECT p.id,p.name,p.description,p.status,p.status_note,p.updated_at,
    count(DISTINCT pr.repository_provider_id)::integer AS repository_count,
    count(DISTINCT CASE WHEN ri.detailed_at IS NOT NULL THEN ri.provider_id END)::integer AS inspected_count,
    max(ri.last_activity_at) AS latest_repository_activity
   FROM lookout_project_access a
   JOIN portfolio_projects p ON p.id=a.portfolio_project_id
   LEFT JOIN portfolio_repository_links pr ON pr.portfolio_project_id=p.id
   LEFT JOIN repository_inventory ri ON ri.provider_id=pr.repository_provider_id
   WHERE a.organisation_id=${organisationId}
   GROUP BY p.id,p.name,p.description,p.status,p.status_note,p.updated_at
   ORDER BY p.name,p.id LIMIT 300
  `),
  db.execute(sql`
   SELECT event_id,portfolio_project_id,project_name,agent,title,summary,recorded_at FROM (
    SELECT ('agent-' || c.id::text) AS event_id,c.portfolio_project_id,
      p.name AS project_name,c.agent, c.title,
      COALESCE(c.payload->>'summary','') AS summary,c.recorded_at
    FROM agent_contributions c
    JOIN lookout_project_access a ON a.portfolio_project_id=c.portfolio_project_id
    JOIN portfolio_projects p ON p.id=c.portfolio_project_id
    WHERE a.organisation_id=${organisationId}
    UNION ALL
    SELECT ('chatgpt-' || c.id::text) AS event_id,c.portfolio_project_id,
      p.name AS project_name,'ChatGPT' AS agent,
      COALESCE(c.payload->>'title','ChatGPT contribution') AS title,
      COALESCE(c.payload->>'summary','') AS summary,c.recorded_at
    FROM chatgpt_contributions c
    JOIN lookout_project_access a ON a.portfolio_project_id=c.portfolio_project_id
    JOIN portfolio_projects p ON p.id=c.portfolio_project_id
    WHERE a.organisation_id=${organisationId}
   ) activity ORDER BY recorded_at DESC LIMIT 12
  `)
 ]);
 return {
  projects:projects.map(r=>({id:Number(r.id),name:String(r.name),description:r.description==null?null:String(r.description),
    status:r.status==null?null:String(r.status),statusNote:r.status_note==null?null:String(r.status_note),
    updatedAt:String(r.updated_at),repositoryCount:Number(r.repository_count),inspectedCount:Number(r.inspected_count),
    latestRepositoryActivity:r.latest_repository_activity==null?null:String(r.latest_repository_activity)})),
  recentActivity:activity.map(r=>({id:String(r.event_id),projectId:Number(r.portfolio_project_id),
    projectName:String(r.project_name),agent:String(r.agent),title:String(r.title),
    summary:String(r.summary),recordedAt:String(r.recorded_at)}))
 };
}

/** Refuses missing grants rather than falling through to global project records. */
export async function getTenantLookoutProject(organisationId:number,projectId:number) {
 if (![organisationId,projectId].every(x=>Number.isSafeInteger(x)&&x>0))return null;
 const rows=await getDatabase().execute(sql`
  SELECT p.id,p.name,p.description,p.status,p.status_note,
    ri.name AS repository_name,ri.url AS repository_url,ri.visibility AS repository_visibility,
    ri.detailed_at AS inspected_at,ri.last_activity_at AS last_activity_at
  FROM lookout_project_access a
  JOIN portfolio_projects p ON p.id=a.portfolio_project_id
  LEFT JOIN portfolio_repository_links l ON l.portfolio_project_id=p.id
  LEFT JOIN repository_inventory ri ON ri.provider_id=l.repository_provider_id
  WHERE a.organisation_id=${organisationId} AND p.id=${projectId}
  ORDER BY ri.name LIMIT 100
 `);
 if(!rows.length)return null;
 const first=rows[0];
 return {id:Number(first.id),name:String(first.name),
  description:first.description==null?null:String(first.description),
  status:first.status==null?null:String(first.status),
  statusNote:first.status_note==null?null:String(first.status_note),
  repositories:rows.filter(r=>r.repository_url).map(r=>({
   name:String(r.repository_name),url:String(r.repository_url),
   visibility:String(r.repository_visibility??"unknown"),
   inspectedAt:r.inspected_at==null?null:String(r.inspected_at),
   lastActivityAt:r.last_activity_at==null?null:String(r.last_activity_at)
  }))};
}
