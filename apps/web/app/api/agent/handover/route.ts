import { NextRequest, NextResponse } from "next/server";
import { agentIdentity,noStore } from "../../../../lib/agent-auth";
import { getAgentHandover, getPortfolioContributionHandover } from "@lookout/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const identity=await agentIdentity(request);
  if(!identity) return NextResponse.json({error:"Unauthorised"},{status:401,headers:noStore});
  try {
    const [handover, logical] = await Promise.all([
      getAgentHandover(identity.projectId), getPortfolioContributionHandover(identity.projectId)
    ]);
    if(!handover) return NextResponse.json({error:"Project not found"},{status:404,headers:noStore});
    return NextResponse.json({ ...handover, logicalProject: logical?.project ?? null,
      latestContributions: logical?.contributions ?? [],
      trustNote: "Agent contributions are self-reported; human decisions remain authoritative." },{headers:noStore});
  } catch(error) {
    console.error("Agent handover retrieval failed",error);
    return NextResponse.json({error:"Handover unavailable"},{status:500,headers:noStore});
  }
}
