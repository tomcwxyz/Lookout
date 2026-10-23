import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

export type TenantCapability = "portfolio:read" | "project:read" | "contribution:write";

/** Verify membership, active connection and explicit project grant in one query.
 * Never use an org or user ID supplied directly by an MCP tool's arguments.
 * Authentication must independently derive connectionId from a verified secret.
 */
export async function resolveActiveMcpGrant(
  connectionId: number, organisationId: number, portfolioProjectId: number,
  capability: TenantCapability
): Promise<{userId:number; role:string; connectionId:number}|null> {
 if(![connectionId,organisationId,portfolioProjectId].every(n=>Number.isSafeInteger(n)&&n>0))return null;
 const rows=await getDatabase().execute(sql`
  SELECT c.id AS connection_id, c.user_id, m.role
  FROM lookout_mcp_connections c
  JOIN lookout_organisation_memberships m ON m.organisation_id=c.organisation_id AND m.user_id=c.user_id
  JOIN lookout_users u ON u.id=c.user_id AND u.disabled_at IS NULL
  JOIN lookout_project_access a ON a.organisation_id=c.organisation_id AND a.portfolio_project_id=${portfolioProjectId}
  JOIN lookout_mcp_grants g ON g.connection_id=c.id
  WHERE c.id=${connectionId} AND c.organisation_id=${organisationId}
    AND c.revoked_at IS NULL
    AND (g.scope=${capability} AND g.portfolio_project_id=${portfolioProjectId}
      OR g.scope='portfolio:read' AND g.portfolio_project_id IS NULL AND ${capability}<>'contribution:write')
    AND (${capability}<>'contribution:write' OR m.role IN ('owner','admin','member'))
  LIMIT 1
 `);
 return rows[0]?{userId:Number(rows[0].user_id),role:String(rows[0].role),
   connectionId:Number(rows[0].connection_id)}:null;
}

/** Query only the contributions explicitly assigned to an organisation's project.
 * Do not return unassigned legacy observations.
 */
export async function listTenantChatgptContributions(organisationId:number,portfolioProjectId:number){
 if(![organisationId,portfolioProjectId].every(n=>Number.isSafeInteger(n)&&n>0))return [];
 const rows=await getDatabase().execute(sql`
  SELECT c.id,c.kind,c.payload,c.recorded_at
  FROM chatgpt_contributions c
  JOIN lookout_project_access a ON a.portfolio_project_id=c.portfolio_project_id
  WHERE a.organisation_id=${organisationId} AND c.portfolio_project_id=${portfolioProjectId}
  ORDER BY c.recorded_at DESC LIMIT 40
 `);
 return rows.map(r=>({id:Number(r.id),kind:String(r.kind),payload:r.payload,recordedAt:r.recorded_at}));
}
