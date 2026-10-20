import { NextRequest, NextResponse } from "next/server";
import { acceptedWorkStatuses, getProject, saveWorkDecision, type AcceptedWorkStatus } from "@lookout/db";
import { deriveWorkHandover } from "@lookout/core";
import { sameOriginPost } from "../../../../lib/scan-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!sameOriginPost(request.headers.get("origin"), request.nextUrl.origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  let body: { projectId?: unknown; workKey?: unknown; status?: unknown; note?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!Number.isSafeInteger(body.projectId) || Number(body.projectId) <= 0 ||
      typeof body.workKey !== "string" || body.workKey.length < 1 || body.workKey.length > 300 ||
      typeof body.note !== "string" || body.note.length > 500) {
    return NextResponse.json({ error: "Invalid work decision" }, { status: 400 });
  }
  const valid = body.status === null || (
    typeof body.status === "string" && (acceptedWorkStatuses as readonly string[]).includes(body.status)
  );
  if (!valid) return NextResponse.json({ error: "Unknown work status" }, { status: 400 });
  try {
    const id = Number(body.projectId);
    const data = await getProject(id);
    if (!data.project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const evidence = deriveWorkHandover(data.project.snapshot);
    if (!evidence.items.some(item => item.key === body.workKey)) {
      return NextResponse.json({ error: "Work item not found in latest observation" }, { status: 404 });
    }
    await saveWorkDecision(id, body.workKey, body.status as AcceptedWorkStatus | null, body.note);
    return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lookout work decision failed", error);
    return NextResponse.json({ error: "Could not save decision" }, { status: 500 });
  }
}
