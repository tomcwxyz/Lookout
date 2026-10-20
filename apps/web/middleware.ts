import { NextRequest, NextResponse } from "next/server";

/**
 * No unprotected production dashboard: a single-user Basic gate until proper
 * multi-user authentication is built. Run behind HTTPS only.
 */
export function middleware(request: NextRequest) {
  const secret = process.env.LOOKOUT_DASHBOARD_TOKEN;
  if (!secret && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (!secret) return new NextResponse("Lookout requires LOOKOUT_DASHBOARD_TOKEN", { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  let password = "";
  try {
    if (auth.startsWith("Basic ")) password = atob(auth.slice(6)).split(":").slice(1).join(":");
  } catch {
    // Malformed credentials are simply unauthorised.
  }
  if (password === secret) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lookout", charset="UTF-8"', "Cache-Control": "no-store" }
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
