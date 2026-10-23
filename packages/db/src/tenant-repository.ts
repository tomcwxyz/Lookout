import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

/** Verified issuer/subject only. Untrusted email or organisation hints never authorise access. */
export async function resolveOrganisationMember(issuer: string, subject: string, organisationId: number) {
  if (!issuer.startsWith("https://") || !subject || subject.length > 512 ||
      !Number.isSafeInteger(organisationId) || organisationId < 1) return null;
  const rows = await getDatabase().execute(sql`
    SELECT m.organisation_id, m.user_id, m.role
    FROM lookout_auth_identities i
    JOIN lookout_users u ON u.id=i.user_id AND u.disabled_at IS NULL
    JOIN lookout_organisation_memberships m ON m.user_id=i.user_id
    WHERE i.issuer=${issuer} AND i.subject=${subject}
      AND m.organisation_id=${organisationId}
    LIMIT 1
  `);
  return rows[0] ? {organisationId:Number(rows[0].organisation_id),
    userId:Number(rows[0].user_id),role:String(rows[0].role)} : null;
}

/** The lookup joins tenant ownership; a guessed project ID cannot bypass isolation. */
export async function authorisedPortfolioProject(organisationId: number, portfolioId: number) {
  if (![organisationId,portfolioId].every(id=>Number.isSafeInteger(id)&&id>0)) return null;
  const rows=await getDatabase().execute(sql`
    SELECT p.id,p.name,p.status
    FROM portfolio_projects p
    INNER JOIN lookout_project_access access ON access.portfolio_project_id=p.id
    WHERE access.organisation_id=${organisationId} AND p.id=${portfolioId}
    LIMIT 1
  `);
  return rows[0] ? {id:Number(rows[0].id),name:String(rows[0].name),
    status: rows[0].status == null ? null : String(rows[0].status)} : null;
}

/** Never treat an unassigned project as publicly readable. */
export async function listTenantPortfolioProjects(organisationId: number) {
  if (!Number.isSafeInteger(organisationId) || organisationId<1) return [];
  const rows=await getDatabase().execute(sql`
    SELECT p.id,p.name,p.status FROM portfolio_projects p
    INNER JOIN lookout_project_access access ON access.portfolio_project_id=p.id
    WHERE access.organisation_id=${organisationId} ORDER BY p.name,p.id LIMIT 300
  `);
  return rows.map(r=>({id:Number(r.id),name:String(r.name),
    status:r.status==null?null:String(r.status)}));
}
