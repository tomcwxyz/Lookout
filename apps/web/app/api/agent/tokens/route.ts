import { NextRequest, NextResponse } from "next/server";
import { createAgentToken, listAgentTokens, revokeAgentToken } from "@lookout/db";
import { sameOriginPost } from "../../../../lib/scan-request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
function projectId(value:string|null) {
  const id=Number(value);
  return value && Number.isSafeInteger(id) && id>0 ? id:null;
}
export async function GET(req:NextRequest) {
  const id=projectId(req.nextUrl.searchParams.get("projectId"));
  if (!id) return NextResponse.json({error:"Invalid project"},{status:400,headers:noStore});
  try {return NextResponse.json({tokens:await listAgentTokens(id)},{headers:noStore});}
  catch {return NextResponse.json({error:"Could not list tokens"},{status:500,headers:noStore});}
}
export async function POST(req:NextRequest) {
  if(!sameOriginPost(req.headers.get("origin"),req.nextUrl.origin))
    return NextResponse.json({error:"Forbidden"},{status:403,headers:noStore});
  if(Number(req.headers.get("content-length")||0)>2048)
    return NextResponse.json({error:"Request too large"},{status:413,headers:noStore});
  let body:unknown;
  try {body=await req.json();} catch {return NextResponse.json({error:"Invalid JSON"},{status:400,headers:noStore});}
  if(!body||typeof body!=="object") return NextResponse.json({error:"Invalid request"},{status:400,headers:noStore});
  const {projectId:raw,label} = body as Record<string,unknown>;
  if(!Number.isSafeInteger(raw)||Number(raw)<1||typeof label!=="string"||!label.trim()||label.length>90)
    return NextResponse.json({error:"Invalid project or label"},{status:400,headers:noStore});
  try {
    const result=await createAgentToken(raw as number,label);
    return NextResponse.json({token:result.token,id:result.id,warning:"Shown once. Keep this token private."},
      {status:201,headers:noStore});
  } catch {
    return NextResponse.json({error:"Token creation failed; check the project and database"},{status:400,headers:noStore});
  }
}
export async function DELETE(req:NextRequest) {
  if(!sameOriginPost(req.headers.get("origin"),req.nextUrl.origin))
    return NextResponse.json({error:"Forbidden"},{status:403,headers:noStore});
  let body:unknown;
  try {body=await req.json();} catch {return NextResponse.json({error:"Invalid JSON"},{status:400,headers:noStore});}
  if(!body||typeof body!=="object") return NextResponse.json({error:"Invalid body"},{status:400,headers:noStore});
  const {projectId,tokenId}=body as Record<string,unknown>;
  if(!Number.isSafeInteger(projectId)||Number(projectId)<1||!Number.isSafeInteger(tokenId)||Number(tokenId)<1)
    return NextResponse.json({error:"Invalid token reference"},{status:400,headers:noStore});
  try {
    const revoked=await revokeAgentToken(projectId as number,tokenId as number);
    return NextResponse.json({revoked},{status:revoked?200:404,headers:noStore});
  } catch {return NextResponse.json({error:"Revocation failed"},{status:500,headers:noStore});}
}
