import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured, saveIdea } from "@lookout/db";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  // A credentialed cross-site browser POST should never write through Basic Auth.
  if (!origin || origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { title?: unknown; projectId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.title !== "string" || typeof body.projectId !== "number" || !Number.isSafeInteger(body.projectId) || body.projectId <= 0) {
    return NextResponse.json({ error: "A valid project ID and title are required" }, { status: 400 });
  }
  try {
    const [idea] = await saveIdea({ title: body.title, projectId: body.projectId });
    return NextResponse.json({ id: idea.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save idea" }, { status: 400 });
  }
}
