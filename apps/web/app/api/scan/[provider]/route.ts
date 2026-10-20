import { NextRequest, NextResponse } from "next/server";
import { observationProviders, runObservation } from "@lookout/worker";
import { ObservationAlreadyRunningError } from "@lookout/db";
import { sameOriginPost } from "../../../../lib/scan-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Authenticated browser action: middleware still requires dashboard Basic Auth. */
export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  if (!sameOriginPost(request.headers.get("origin"), request.nextUrl.origin)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const { provider } = await context.params;
  if (!observationProviders.some(item => item === provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  try {
    const result = await runObservation(provider as (typeof observationProviders)[number]);
    return NextResponse.json({ ...result, completedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ObservationAlreadyRunningError) {
      return NextResponse.json({ provider, status: "already_running", error: "A scan is already running for this source" }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Lookout manual scan failed for " + provider, error);
    return NextResponse.json({ provider, status: "failed", error: "Scan failed. Check observation history or Vercel logs." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
