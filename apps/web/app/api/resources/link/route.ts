import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured, setInfrastructureProjectLink } from "@lookout/db";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { resourceKey?: unknown; projectId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.resourceKey !== "string" || body.resourceKey.length > 250 || !/^(neon|vercel):/.test(body.resourceKey)
    || (body.projectId !== null && (typeof body.projectId !== "number" || !Number.isSafeInteger(body.projectId) || body.projectId <= 0))) {
    return NextResponse.json({ error: "Invalid resource or project ID" }, { status: 400 });
  }
  try {
    await setInfrastructureProjectLink(body.resourceKey, body.projectId as number | null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Resource or project not found" }, { status: 404 });
  }
}
