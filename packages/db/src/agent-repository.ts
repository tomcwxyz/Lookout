import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { checkpointNextStep, parseCheckpoint, type CheckpointInput } from "@lookout/core";
import { getDatabase } from "./client";
import { agentAccessTokens, agentCheckpoints, projects, workDecisions } from "./schema";

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
/** Token is returned ONCE. Only a salted? No: SHA-256 of 256-bit random tokens is sufficient. */
export async function createAgentToken(projectId: number, label: string) {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("Invalid project");
  if (!label.trim() || label.length > 90) throw new Error("Invalid label");
  const db = getDatabase();
  const known = await db.select({id:projects.id}).from(projects).where(eq(projects.id,projectId)).limit(1);
  if (!known.length) throw new Error("Unknown project");
  const token = "lkp_" + randomBytes(32).toString("hex");
  const [row] = await db.insert(agentAccessTokens).values({
    projectId,label:label.trim(),prefix:token.slice(0,12),tokenHash:tokenFingerprint(token)
  }).returning({id:agentAccessTokens.id});
  return { id:row!.id, token };
}
export async function listAgentTokens(projectId: number) {
  return getDatabase().select({
    id:agentAccessTokens.id,label:agentAccessTokens.label,prefix:agentAccessTokens.prefix,
    createdAt:agentAccessTokens.createdAt,revokedAt:agentAccessTokens.revokedAt
  }).from(agentAccessTokens).where(eq(agentAccessTokens.projectId,projectId))
    .orderBy(desc(agentAccessTokens.createdAt));
}
export async function revokeAgentToken(projectId: number, tokenId: number) {
  const rows=await getDatabase().update(agentAccessTokens).set({revokedAt:new Date()})
    .where(and(eq(agentAccessTokens.projectId,projectId),eq(agentAccessTokens.id,tokenId),isNull(agentAccessTokens.revokedAt)))
    .returning({id:agentAccessTokens.id});
  return rows.length>0;
}
export async function authoriseAgentToken(raw: string | null) {
  if(!raw || !/^lkp_[a-f0-9]{64}$/.test(raw)) return null;
  const result=await getDatabase().select({
    id:agentAccessTokens.id,projectId:agentAccessTokens.projectId,label:agentAccessTokens.label
  }).from(agentAccessTokens).where(and(
    eq(agentAccessTokens.tokenHash,tokenFingerprint(raw)),isNull(agentAccessTokens.revokedAt)
  )).limit(1);
  return result[0] ?? null;
}
export class CheckpointConflictError extends Error {
  constructor(){super("This checkpoint ID already exists with different content");}
}
export async function submitAgentCheckpoint(projectId:number,tokenId:number,input:unknown) {
  const cp=parseCheckpoint(input);
  const hash=createHash("sha256").update(JSON.stringify(cp)).digest("hex");
  const db=getDatabase();
  const inserted=await db.insert(agentCheckpoints).values({
    projectId,tokenId,eventId:cp.eventId,agent:cp.agent,title:cp.title,payload:cp,payloadHash:hash
  }).onConflictDoNothing({target:[agentCheckpoints.projectId,agentCheckpoints.eventId]})
    .returning({id:agentCheckpoints.id});
  if(inserted[0]) return {id:inserted[0].id,duplicate:false,status:"proposed" as const};
  const rows=await db.select({id:agentCheckpoints.id,payloadHash:agentCheckpoints.payloadHash})
    .from(agentCheckpoints).where(and(eq(agentCheckpoints.projectId,projectId),
      eq(agentCheckpoints.eventId,cp.eventId))).limit(1);
  if(rows[0]?.payloadHash!==hash) throw new CheckpointConflictError();
  return {id:rows[0].id,duplicate:true,status:"proposed" as const};
}
export async function listAgentCheckpoints(projectId:number,limit=30) {
  const size=Math.min(Math.max(1,limit),60);
  const rows=await getDatabase().select({
    id:agentCheckpoints.id,projectId:agentCheckpoints.projectId,eventId:agentCheckpoints.eventId,
    agent:agentCheckpoints.agent,title:agentCheckpoints.title,payload:agentCheckpoints.payload,
    recordedAt:agentCheckpoints.recordedAt,status:agentCheckpoints.status
  }).from(agentCheckpoints).where(eq(agentCheckpoints.projectId,projectId))
    .orderBy(desc(agentCheckpoints.recordedAt),desc(agentCheckpoints.id)).limit(size);
  return rows.map(row=>({...row,source:"agent" as const,nextStep:checkpointNextStep(row.payload)}));
}
export async function getAgentHandover(projectId:number) {
  const [project, checkpoints, decisions] = await Promise.all([
    getDatabase().select({id:projects.id,name:projects.name,slug:projects.slug,
      url:projects.url,snapshot:projects.snapshot,observedAt:projects.observedAt})
      .from(projects).where(eq(projects.id,projectId)).limit(1),
    listAgentCheckpoints(projectId,12),
    getDatabase().select({workKey:workDecisions.workKey,status:workDecisions.status,
      note:workDecisions.note,updatedAt:workDecisions.updatedAt})
      .from(workDecisions).where(eq(workDecisions.projectId,projectId)).limit(60)
  ]);
  if(!project[0]) return null;
  // Do not expose the entire snapshot or secrets to a scoped agent token.
  const pr=project[0].snapshot.pullRequests.slice(0,10).map(x=>({
    number:x.number,title:x.title,url:x.url,draft:x.draft,updatedAt:x.updatedAt,
    reviewStatus:x.reviewStatus,checks:x.checks
  }));
  return {
    project:{id:project[0].id,name:project[0].name,slug:project[0].slug,url:project[0].url,
      observedAt:project[0].observedAt},
    openPullRequests:pr,
    latestCheckpoints:checkpoints,
    humanDecisions:decisions,
    trustNote:"Agent checkpoints are self-reports, not verified test or delivery evidence."
  };
}
