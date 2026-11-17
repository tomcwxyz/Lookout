import { NextRequest, NextResponse } from "next/server";
import { agentIdentity, noStore } from "../../../../lib/agent-auth";
import { getPortfolioIdForObservedProject, getSharedHandoverContext } from "@lookout/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Same scoped, consolidated project position returned by hosted ChatGPT MCP. */
export async function GET(request:NextRequest) {
  const identity=await agentIdentity(request);
  if(!identity) return NextResponse.json({error:"Unauthorised"},{status:401,headers:noStore});
  try {
    const portfolioId=await getPortfolioIdForObservedProject(identity.projectId);
    if(!portfolioId) return NextResponse.json({error:"Project not linked"},{status:404,headers:noStore});
    const context=await getSharedHandoverContext(portfolioId,identity.projectId);
    return context?NextResponse.json(context,{headers:noStore}):
      NextResponse.json({error:"Project not found"},{status:404,headers:noStore});
  } catch(error) {
    console.error("Shared handover context unavailable",error);
    return NextResponse.json({error:"Context unavailable"},{status:503,headers:noStore});
  }
}
