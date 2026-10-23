import { NextRequest } from "next/server";
import { listVerifiedIdentityOrganisations } from "@lookout/db";
import { verifyLabBearer } from "../../../../lib/lab-neon-jwt";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
/** Discover organisation memberships, never trust organisation/user IDs from the client. */
export async function GET(request:NextRequest){
 if(process.env.LOOKOUT_MULTIUSER_LAB!=="enabled")
  return Response.json({error:"Not found"},{status:404,headers});
 const identity=await verifyLabBearer(request);
 if(!identity)return Response.json({error:"Unauthorised"},{status:401,headers});
 try{
  const organisations=await listVerifiedIdentityOrganisations(identity.issuer,identity.subject);
  return Response.json({organisations},{headers});
 }catch{return Response.json({error:"Unavailable"},{status:503,headers});}
}
