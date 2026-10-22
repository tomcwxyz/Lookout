import { NextRequest, NextResponse } from "next/server";
import { assignRepositoryToProject, databaseConfigured } from "@lookout/db";
import { sameOriginPost } from "../../../../lib/scan-request";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOriginPost(request.headers.get("origin"), request.nextUrl.origin))
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  let body: { repositoryProviderId?: unknown; portfolioProjectId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.repositoryProviderId !== "string" || !/^\\d{1,25}$/.test(body.repositoryProviderId)
    || typeof body.portfolioProjectId !== "number" || !Number.isSafeInteger(body.portfolioProjectId) || body.portfolioProjectId < 1)
    return NextResponse.json({ error: "Invalid repository association" }, { status: 400 });
  try {
    await assignRepositoryToProject(body.repositoryProviderId, body.portfolioProjectId);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Project or repository not found" }, { status: 404 }); }
}
