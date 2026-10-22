import { revokeAllOAuthTokens } from "@lookout/db";
import { ISSUER, NO_STORE } from "../../../../lib/chatgpt-oauth";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Middleware requires dashboard Basic auth. Same-origin POST prevents CSRF.
  if (request.headers.get("origin") !== ISSUER)
    return new Response("Forbidden", { status: 403, headers: NO_STORE });
  try {
    await revokeAllOAuthTokens();
    return new Response(null, { status: 303, headers: {
      ...NO_STORE, Location: ISSUER + "/connections?oauth=disconnected"
    } });
  } catch (error) {
    console.error("Lookout OAuth revocation unavailable", error);
    return new Response("Unable to disconnect", { status: 503, headers: NO_STORE });
  }
}
