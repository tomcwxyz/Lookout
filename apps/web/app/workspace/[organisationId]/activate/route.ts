import { NextRequest, NextResponse } from "next/server";
import { listVerifiedIdentityOrganisations } from "@lookout/db";
import { getLabIdentity } from "../../../../lib/auth/lab-server";
import { ACTIVE_ORGANISATION_COOKIE } from "../../../../lib/auth/lookout-context";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: {params:Promise<{organisationId:string}>}) {
  if (process.env.LOOKOUT_MULTIUSER_LAB !== "enabled") return new Response("Not found", {status:404});
  const identity = await getLabIdentity();
  if (!identity?.authenticated) return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  const {organisationId:raw} = await context.params;
  if (!/^[1-9][0-9]{0,12}$/.test(raw)) return new Response("Not found", {status:404});
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) return new Response("Not found", {status:404});
  const memberships = await listVerifiedIdentityOrganisations(identity.issuer, identity.subject);
  if (!memberships.some(item=>item.id===id)) return new Response("Not found", {status:404});
  const response=NextResponse.redirect(new URL("/",request.url));
  response.cookies.set(ACTIVE_ORGANISATION_COOKIE,String(id),{
    httpOnly:true, secure:request.nextUrl.protocol==="https:", sameSite:"lax",path:"/",maxAge:60*60*24*30
  });
  response.headers.set("Cache-Control","no-store");
  return response;
}
