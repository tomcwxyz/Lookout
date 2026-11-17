import { NextRequest, NextResponse } from "next/server";
import { agentIdentity, noStore } from "../../../../lib/agent-auth";
import { getPortfolioIdForObservedProject, submitReconciledHandover,
  getHandoverReconciliation, HandoverEventConflictError } from "@lookout/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function scoped(request:NextRequest) {
  const identity=await agentIdentity(request);
  if(!identity) return null;
  const portfolioId=await getPortfolioIdForObservedProject(identity.projectId);
  return portfolioId?{identity,portfolioId}:null;
}
export async function GET(request:NextRequest) {
  try {
    const access=await scoped(request);
    if(!access) return NextResponse.json({error:"Unauthorised"},{status:401,headers:noStore});
    const eventId=request.nextUrl.searchParams.get("eventId") ?? "";
    const result=await getHandoverReconciliation(access.portfolioId,eventId);
    return result?NextResponse.json(result,{headers:noStore}):
      NextResponse.json({error:"Handover not found"},{status:404,headers:noStore});
  } catch { return NextResponse.json({error:"Receipt unavailable"},{status:400,headers:noStore}); }
}
export async function POST(request:NextRequest) {
  let access;
  try { access=await scoped(request); }
  catch { return NextResponse.json({error:"Authentication unavailable"},{status:503,headers:noStore}); }
  if(!access) return NextResponse.json({error:"Unauthorised"},{status:401,headers:noStore});
  if(Number(request.headers.get("content-length") || 0)>30000)
    return NextResponse.json({error:"Handover too large"},{status:413,headers:noStore});
  let raw:unknown;
  try {
    const body=await request.text();
    if(Buffer.byteLength(body,"utf8")>30000) return NextResponse.json({error:"Handover too large"},{status:413,headers:noStore});
    raw=JSON.parse(body);
  } catch { return NextResponse.json({error:"Invalid JSON"},{status:400,headers:noStore}); }
  try {
    const actor="coding-agent:"+access.identity.id;
    const result=await submitReconciledHandover(access.portfolioId,"agent",actor,raw);
    return NextResponse.json(result,{status:result.duplicate?200:201,headers:noStore});
  } catch(error) {
    if(error instanceof HandoverEventConflictError) return NextResponse.json({error:error.message},{status:409,headers:noStore});
    if(error instanceof Error && /^(Invalid|Expected)/.test(error.message))
      return NextResponse.json({error:error.message},{status:400,headers:noStore});
    console.error("Reconciled handover failed",error);
    return NextResponse.json({error:"Handover unavailable"},{status:503,headers:noStore});
  }
}
