import { NextRequest, NextResponse } from "next/server";
import { observationProviders, runObservation } from "@lookout/worker";
import { cronAuthorised } from "../../../../lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  // Unlike the dashboard, cron auth is a dedicated bearer token.
  if (!cronAuthorised(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { provider } = await context.params;
  if (!observationProviders.some(p => p === provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  try {
    const result = await runObservation(provider as (typeof observationProviders)[number]);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lookout scheduled " + provider + " observation failed", error);
    return NextResponse.json({ provider, status: "failed" }, {
      status: 502, headers: { "Cache-Control": "no-store" }
    });
  }
}
