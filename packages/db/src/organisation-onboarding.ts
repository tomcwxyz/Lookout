import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

/** Only call this function after server-side Neon Auth session verification.
 * Never accept issuer/subject from form bodies, query parameters or browser headers.
 * The onboarding operation is atomic; an unknown identity cannot claim an existing org.
 */
export async function onboardVerifiedIdentity(args:{
 issuer:string; subject:string; verifiedEmail:string; organisationName:string; organisationSlug:string
}) {
 const {issuer,subject,verifiedEmail,organisationName,organisationSlug}=args;
 if(!issuer.startsWith("https://")||!subject||subject.length>512||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedEmail)||
    organisationName.trim().length<2||organisationName.length>100||
    !/^[a-z0-9][a-z0-9-]{2,49}$/.test(organisationSlug)) throw new Error("Invalid onboarding details");
 return getDatabase().transaction(async tx=>{
  const existing=await tx.execute(sql`SELECT user_id FROM lookout_auth_identities WHERE issuer=${issuer} AND subject=${subject} LIMIT 1`);
  if(existing.length) throw new Error("Identity already onboarded");
  const claimed=await tx.execute(sql`SELECT id FROM lookout_organisations WHERE slug=${organisationSlug} LIMIT 1`);
  if(claimed.length) throw new Error("Organisation slug unavailable");
  const user=await tx.execute(sql`INSERT INTO lookout_users(email)
    VALUES(${verifiedEmail}) ON CONFLICT DO NOTHING RETURNING id`);
  if(!user.length) throw new Error("Email already linked to an account; link identities through an authenticated account instead");
  const userId=Number(user[0].id);
  const organisation=await tx.execute(sql`INSERT INTO lookout_organisations(slug,name)
    VALUES(${organisationSlug},${organisationName.trim()}) ON CONFLICT DO NOTHING RETURNING id`);
  if(!organisation.length) throw new Error("Organisation slug unavailable");
  const organisationId=Number(organisation[0].id);
  await tx.execute(sql`INSERT INTO lookout_auth_identities(user_id,issuer,subject) VALUES(${userId},${issuer},${subject})`);
  await tx.execute(sql`INSERT INTO lookout_organisation_memberships(organisation_id,user_id,role)
    VALUES(${organisationId},${userId},'owner')`);
  return {userId,organisationId,role:"owner" as const};
 });
}
