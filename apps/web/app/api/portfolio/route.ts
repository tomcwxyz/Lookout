import { NextRequest, NextResponse } from "next/server";
import { createLogicalProject, createAccountProject, databaseConfigured } from "@lookout/db";
import { getLookoutContext } from "../../../lib/auth/lookout-context";
import { sameOriginPost } from "../../../lib/scan-request";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOriginPost(request.headers.get("origin"), request.nextUrl.origin))
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  let body: { name?: unknown; description?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120
    || (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 2000)))
    return NextResponse.json({ error: "Invalid project details" }, { status: 400 });
  const context=await getLookoutContext();
  try {
    if(context.mode==="account" && context.role==="viewer") return NextResponse.json({error:"Insufficient organisation permissions"},{status:403});
    const id = context.mode === "account"
      ? await createAccountProject(context.organisationId,body.name,body.description as string | undefined)
      : await createLogicalProject(body.name, body.description as string | undefined);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create project" }, { status: 500 });
  }
}
