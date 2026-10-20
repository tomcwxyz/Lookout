import { NextRequest, NextResponse } from "next/server";
import { agentIdentity,noStore } from "../../../../lib/agent-auth";
import { submitAgentCheckpoint,listAgentCheckpoints,CheckpointConflictError } from "@lookout/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const identity=await agentIdentity(request);
  if(!identity) return NextResponse.json({error:"Unauthorised"},{status:401,headers:noStore});
  return NextResponse.json({projectId:identity.projectId,checkpoints:await listAgentCheckpoints(identity.projectId,30)},
    {headers:noStore});
}
export async function POST(request:NextRequest) {
  const identity=await agentIdentity(request);
  if(!identity) return NextResponse.json({error:"Unauthorised"},{status:401,headers:noStore});
  if(Number(request.headers.get("content-length")||0)>30000)
    return NextResponse.json({error:"Checkpoint too large"},{status:413,headers:noStore});
  let body:unknown;
  try {body=await request.json();} catch {
    return NextResponse.json({error:"Invalid JSON"},{status:400,headers:noStore});
  }
  try {
    const checkpoint=(body&&typeof body==="object"&&"checkpoint" in body)
      ? (body as {checkpoint:unknown}).checkpoint : body;
    const saved=await submitAgentCheckpoint(identity.projectId,identity.id,checkpoint);
    return NextResponse.json({...saved,projectId:identity.projectId,trust:"agent_reported"},
      {status:saved.duplicate?200:201,headers:noStore});
  } catch(error) {
    if(error instanceof CheckpointConflictError)
      return NextResponse.json({error:error.message},{status:409,headers:noStore});
    if(error instanceof Error && /^(Invalid|Expected|Unsupported|eventId|PR URL)/.test(error.message))
      return NextResponse.json({error:error.message},{status:400,headers:noStore});
    console.error("Lookout checkpoint storage failed",error);
    return NextResponse.json({error:"Checkpoint storage unavailable"},{status:500,headers:noStore});
  }
}
