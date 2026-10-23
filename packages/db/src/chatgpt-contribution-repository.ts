import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { parseContribution } from "@lookout/core";
import { getDatabase } from "./client";

export async function submitChatgptContribution(portfolioId:number,clientId:string,input:unknown){
 if(!Number.isSafeInteger(portfolioId)||portfolioId<1 || !clientId.startsWith("https://chatgpt.com/")) throw new Error("Invalid project or client");
 const parsed=parseContribution(input);
 const payload=JSON.stringify(parsed.checkpoint);
 if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s]+@|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{30,}|lkp_[a-f0-9]{40,})/i.test(payload)) throw new Error("Contribution contains a potential credential");
 const hash=createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
 return getDatabase().transaction(async tx=>{
  const projects=await tx.execute(sql`SELECT id FROM portfolio_projects WHERE id=${portfolioId} LIMIT 1`);
  if(!projects.length) throw new Error("Portfolio project not found");
  const prev=await tx.execute(sql`SELECT id,payload_hash FROM chatgpt_contributions WHERE portfolio_project_id=${portfolioId} AND client_id=${clientId} AND event_id=${parsed.checkpoint.eventId} LIMIT 1`);
  if(prev.length){if(prev[0].payload_hash!==hash)throw new Error("Conflicting event ID");return {id:Number(prev[0].id),duplicate:true,trust:"agent_reported"};}
  const usage=await tx.execute(sql`SELECT count(*)::int AS total FROM chatgpt_contributions WHERE client_id=${clientId} AND recorded_at > now()-interval '1 day'`);
  if(Number(usage[0]?.total??0)>=100)throw new Error("Contribution rate limit reached");
  const rows=await tx.execute(sql`INSERT INTO chatgpt_contributions (portfolio_project_id,client_id,event_id,kind,payload,payload_hash) VALUES (${portfolioId},${clientId},${parsed.checkpoint.eventId},${parsed.kind},${payload}::jsonb,${hash}) ON CONFLICT DO NOTHING RETURNING id`);
  return {id:Number(rows[0]?.id??0),duplicate:!rows.length,trust:"agent_reported"};
 });
}
export async function listChatgptContributions(portfolioId:number){
 if(!Number.isSafeInteger(portfolioId)||portfolioId<1) throw new Error("Invalid portfolio ID");
 return getDatabase().execute(sql`SELECT id,portfolio_project_id,kind,payload,recorded_at FROM chatgpt_contributions WHERE portfolio_project_id=${portfolioId} ORDER BY recorded_at DESC LIMIT 40`);
}
