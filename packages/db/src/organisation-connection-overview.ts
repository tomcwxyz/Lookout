import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

export async function getOrganisationConnectionOverview(organisationId:number) {
 if(!Number.isSafeInteger(organisationId)||organisationId<=0)return {connections:[],active:0};
 const rows=await getDatabase().execute(sql`
 SELECT c.id,c.display_name,c.created_at,c.revoked_at,c.expires_at,
  count(DISTINCT g.portfolio_project_id)::int granted_projects,
  count(DISTINCT g.scope)::int granted_scopes
 FROM lookout_mcp_connections c
 LEFT JOIN lookout_mcp_grants g ON g.connection_id=c.id
 WHERE c.organisation_id=${organisationId} AND c.token_hash IS NOT NULL
 GROUP BY c.id,c.display_name,c.created_at,c.revoked_at,c.expires_at ORDER BY c.created_at DESC LIMIT 50
 `);
 const connections=rows.map(r=>({id:Number(r.id),name:String(r.display_name),
  createdAt:String(r.created_at),expiresAt:r.expires_at==null?null:String(r.expires_at),
  active:r.revoked_at==null&&r.expires_at!=null&&Date.parse(String(r.expires_at))>Date.now(),
  projects:Number(r.granted_projects),scopes:Number(r.granted_scopes)}));
 return {connections,active:connections.filter(c=>c.active).length};
}
