import { NextRequest, NextResponse } from "next/server";
import { confirmLogicalProject, confirmAccountProjectStatus, confirmedProjectStatuses, databaseConfigured } from "@lookout/db";
import { getLookoutContext } from "../../../../lib/auth/lookout-context";
import { sameOriginPost } from "../../../../lib/scan-request";
export const runtime = "nodejs";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOriginPost(request.headers.get("origin"), request.nextUrl.origin))
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const id = Number((await context.params).id);
  let body: { status?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!Number.isSafeInteger(id) || id <= 0 || (body.status !== null &&
      (typeof body.status !== "string" || !confirmedProjectStatuses.some(s => s === body.status))) ||
      typeof body.note !== "string" || body.note.length > 2000)
    return NextResponse.json({ error: "Invalid project status" }, { status: 400 });
  const account=await getLookoutContext();
  try {
    if(account.mode==="account") {
      if(account.role==="viewer") return NextResponse.json({error:"Insufficient organisation permissions"},{status:403});
      const saved=await confirmAccountProjectStatus(account.organisationId,id,body.status as string|null,body.note);
      if(!saved) return NextResponse.json({error:"Project not found"},{status:404});
    } else {
      await confirmLogicalProject(id, body.status as (typeof confirmedProjectStatuses)[number] | null, body.note);
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Project not found" }, { status: 404 }); }
}
