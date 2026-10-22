import { NextRequest, NextResponse } from "next/server";
import { assignInfrastructureToProject, databaseConfigured } from "@lookout/db";
import { sameOriginPost } from "../../../../../lib/scan-request";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOriginPost(request.headers.get("origin"), request.nextUrl.origin))
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  let body: { resourceKey?: unknown; portfolioProjectId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.resourceKey !== "string" || !/^(neon|vercel):/.test(body.resourceKey) ||
    body.resourceKey.length > 250 || typeof body.portfolioProjectId !== "number" ||
    !Number.isSafeInteger(body.portfolioProjectId) || body.portfolioProjectId < 1)
    return NextResponse.json({ error: "Invalid infrastructure association" }, { status: 400 });
  try {
    await assignInfrastructureToProject(body.resourceKey, body.portfolioProjectId);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Resource or project not found" }, { status: 404 }); }
}
