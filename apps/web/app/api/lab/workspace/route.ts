import { NextRequest } from "next/server";
import { verifiedWorkspaceProjects } from "../../../../lib/verified-workspace";
import { verifyLabBearer } from "../../../../lib/lab-neon-jwt";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
/** Dedicated lab route: requires verified JWT and current DB membership; never shows legacy global portfolio. */
export async function GET(request:NextRequest){
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled")return Response.json({error:"Not found"},{status:404,headers});
 const raw=request.nextUrl.searchParams.get("organisationId");
 const organisationId=raw&&/^[1-9][0-9]{0,12}$/.test(raw)?Number(raw):null;
 if(!organisationId||!Number.isSafeInteger(organisationId))
  return Response.json({error:"Invalid workspace"},{status:400,headers});
 try{
  const data=await verifiedWorkspaceProjects(()=>verifyLabBearer(request),organisationId);
  if(!data)return Response.json({error:"Forbidden"},{status:403,headers});
  return Response.json({organisationId,projects:data.projects,role:data.workspace.role},{headers});
 }catch{return Response.json({error:"Unavailable"},{status:503,headers});}
}
