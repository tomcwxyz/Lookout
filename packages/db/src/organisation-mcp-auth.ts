import {createHash,randomBytes} from "node:crypto";
import {sql} from "drizzle-orm";
import {getDatabase} from "./client";

/** Only server-verified session identities can call issuance/revocation. */
type VerifiedOwner={issuer:string;subject:string;organisationId:number};
const valid=(args:VerifiedOwner)=>args.issuer.startsWith("https://")&&args.subject.length>0&&
 args.subject.length<=512&&Number.isSafeInteger(args.organisationId)&&args.organisationId>0;
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");

export async function issueOrganisationMcpReadToken(args:VerifiedOwner&{label:string}){
 if(!valid(args)||args.label.trim().length<3||args.label.length>80)throw new Error("Invalid connection details");
 const token="lko_"+randomBytes(32).toString("hex");
 const digest=hash(token);
 const result=await getDatabase().transaction(async tx=>{
  const memberships=await tx.execute(sql`
   SELECT m.user_id,m.role FROM lookout_auth_identities i
   JOIN lookout_users u ON u.id=i.user_id AND u.disabled_at IS NULL
   JOIN lookout_organisation_memberships m ON m.user_id=u.id
   WHERE i.issuer=${args.issuer} AND i.subject=${args.subject}
    AND m.organisation_id=${args.organisationId} AND m.role IN ('owner','admin')
   LIMIT 1
  `);
  const member=memberships[0];
  if(!member)throw new Error("Not authorised to create organisation connections");
  const existing=await tx.execute(sql`
   SELECT COUNT(*)::int AS total FROM lookout_mcp_connections
   WHERE organisation_id=${args.organisationId} AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at>now())
  `);
  if(Number(existing[0]?.total??0)>=5)throw new Error("Connection limit reached. Revoke an unused connection first.");
  const connections=await tx.execute(sql`
   INSERT INTO lookout_mcp_connections(organisation_id,user_id,client_id,display_name,token_hash,expires_at)
   VALUES(${args.organisationId},${Number(member.user_id)},'lookout-readonly',${args.label.trim()},${digest},
     now()+interval '90 days')
   RETURNING id,expires_at
  `);
  const id=Number(connections[0].id);
  await tx.execute(sql`
   INSERT INTO lookout_mcp_grants(connection_id,portfolio_project_id,scope)
   VALUES(${id},NULL,'portfolio:read')
  `);
  return {id,expiresAt:new Date(String(connections[0].expires_at)).toISOString()};
 });
 return {...result,token}; // Raw token appears only in this one response, never in a read.
}

export type OrganisationMcpSession={connectionId:number;organisationId:number;userId:number;name:string};
export async function authoriseOrganisationMcpReadToken(raw:string):Promise<OrganisationMcpSession|null>{
 if(!/^lko_[a-f0-9]{64}$/.test(raw))return null;
 const rows=await getDatabase().execute(sql`
 SELECT c.id,c.organisation_id,c.user_id,o.name
 FROM lookout_mcp_connections c
 JOIN lookout_organisations o ON o.id=c.organisation_id
 JOIN lookout_users u ON u.id=c.user_id AND u.disabled_at IS NULL
 JOIN lookout_organisation_memberships m ON m.organisation_id=c.organisation_id AND m.user_id=c.user_id
 JOIN lookout_mcp_grants g ON g.connection_id=c.id
 WHERE c.token_hash=${hash(raw)} AND c.revoked_at IS NULL
  AND c.expires_at>now() AND g.scope='portfolio:read' AND g.portfolio_project_id IS NULL
 LIMIT 1
 `);
 const r=rows[0];
 return r?{connectionId:Number(r.id),organisationId:Number(r.organisation_id),
   userId:Number(r.user_id),name:String(r.name)}:null;
}

export async function revokeOrganisationMcpConnection(args:VerifiedOwner&{connectionId:number}){
 if(!valid(args)||!Number.isSafeInteger(args.connectionId)||args.connectionId<1)return false;
 const rows=await getDatabase().execute(sql`
 UPDATE lookout_mcp_connections c SET revoked_at=now()
 WHERE c.id=${args.connectionId} AND c.organisation_id=${args.organisationId}
  AND c.revoked_at IS NULL
  AND EXISTS (
   SELECT 1 FROM lookout_auth_identities i
   JOIN lookout_users u ON u.id=i.user_id AND u.disabled_at IS NULL
   JOIN lookout_organisation_memberships m ON m.user_id=u.id
   WHERE i.issuer=${args.issuer} AND i.subject=${args.subject}
    AND m.organisation_id=c.organisation_id AND
     (m.role IN ('owner','admin') OR c.user_id=u.id)
  )
 RETURNING c.id
 `);
 return rows.length>0;
}

/** All returned evidence is scoped to granted projects in the token's organisation. */
export async function listOrganisationMcpFindings(organisationId:number){
 if(!Number.isSafeInteger(organisationId)||organisationId<=0)return [];
 const rows=await getDatabase().execute(sql`
 SELECT f.id,p.name AS project_name,p.id AS portfolio_id,f.title,f.explanation,
  f.severity,f.kind,f.evidence_url,f.observed_at
 FROM attention_items f
 JOIN projects observed ON observed.id=f.project_id
 JOIN portfolio_repository_links links ON links.repository_provider_id=observed.provider_id
 JOIN lookout_project_access grants ON grants.portfolio_project_id=links.portfolio_project_id
 JOIN portfolio_projects p ON p.id=links.portfolio_project_id
 WHERE grants.organisation_id=${organisationId} AND f.status='open'
 ORDER BY (CASE WHEN f.severity='critical' THEN 0 ELSE 1 END),f.observed_at DESC
 LIMIT 100
 `);
 return rows.map(r=>({id:Number(r.id),portfolioId:Number(r.portfolio_id),
  project:String(r.project_name),title:String(r.title),severity:String(r.severity),kind:String(r.kind),
  explanation:String(r.explanation),evidenceUrl:String(r.evidence_url),observedAt:String(r.observed_at)}));
}
