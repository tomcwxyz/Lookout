import { NextRequest, NextResponse } from "next/server";
import { agentIdentity, noStore } from "../../../../lib/agent-auth";
import { ContributionConflictError, ContributionRateLimitError, ContributionScopeError,
  getPortfolioIdForObservedProject, listPortfolioContributions, submitAgentContribution } from "@lookout/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const identity = await agentIdentity(request);
  if (!identity) return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStore });
  try {
    const portfolioId = await getPortfolioIdForObservedProject(identity.projectId);
    if (!portfolioId) return NextResponse.json({ error: "No linked logical project" }, { status: 404, headers: noStore });
    return NextResponse.json({ portfolioId,
      contributions: await listPortfolioContributions(portfolioId, 40, identity.projectId),
      trustNote: "Agent contributions are unverified reports." }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Contributions unavailable" }, { status: 503, headers: noStore });
  }
}
export async function POST(request: NextRequest) {
  const identity = await agentIdentity(request);
  if (!identity) return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers: noStore });
  if (Number(request.headers.get("content-length") || 0) > 30000)
    return NextResponse.json({ error: "Contribution too large" }, { status: 413, headers: noStore });
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 30000)
      return NextResponse.json({ error: "Contribution too large" }, { status: 413, headers: noStore });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: noStore }); }
  try {
    const saved = await submitAgentContribution(identity.projectId, identity.id, body);
    return NextResponse.json(saved, { status: saved.duplicate ? 200 : 201, headers: noStore });
  } catch (error) {
    if (error instanceof ContributionConflictError)
      return NextResponse.json({ error: error.message }, { status: 409, headers: noStore });
    if (error instanceof ContributionRateLimitError)
      return NextResponse.json({ error: error.message }, { status: 429, headers: noStore });
    if (error instanceof ContributionScopeError)
      return NextResponse.json({ error: error.message }, { status: 403, headers: noStore });
    if (error instanceof Error && /^(Invalid|Expected|Unsupported|eventId|PR URL|Contribution appears)/.test(error.message))
      return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
    console.error("Agent contribution storage failed", error);
    return NextResponse.json({ error: "Contribution storage unavailable" }, { status: 503, headers: noStore });
  }
}
