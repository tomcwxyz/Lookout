import {sql} from "drizzle-orm";
import {getDatabase} from "./client";
/** Workspace selector is derived from the authenticated subject, never user-supplied identity. */
export async function listVerifiedIdentityOrganisations(issuer:string,subject:string){
 if(!issuer.startsWith("https://")||!subject||subject.length>512)return [];
 const rows=await getDatabase().execute(sql`
 SELECT o.id,o.slug,o.name,m.role FROM lookout_auth_identities i
 JOIN lookout_users u ON u.id=i.user_id AND u.disabled_at IS NULL
 JOIN lookout_organisation_memberships m ON m.user_id=u.id
 JOIN lookout_organisations o ON o.id=m.organisation_id
 WHERE i.issuer=${issuer} AND i.subject=${subject}
 ORDER BY o.name,o.id LIMIT 100`);
 return rows.map(row=>({id:Number(row.id),slug:String(row.slug),name:String(row.name),role:String(row.role)}));
}
