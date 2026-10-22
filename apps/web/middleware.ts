import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Hosted MCP verifies its own personal or project-scoped Bearer token.
  if (request.nextUrl.pathname === "/api/mcp" || request.nextUrl.pathname === "/api/mcp/") {
    return NextResponse.next();
  }
  // Agent endpoints authorise per-project bearer tokens in the route handlers.
  if (/^\/api\/agent\/(?:handover|checkpoints)\/?$/.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  // Cron route handlers perform their own strict CRON_SECRET Bearer check.
  if (/^\/api\/cron\/(?:github|neon|vercel)\/?$/.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const secret = process.env.LOOKOUT_DASHBOARD_TOKEN;
  if (!secret && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (!secret) return new NextResponse("Lookout requires LOOKOUT_DASHBOARD_TOKEN", { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  let password = "";
  try {
    if (auth.startsWith("Basic ")) password = atob(auth.slice(6)).split(":").slice(1).join(":");
  } catch {
    // Malformed credentials are unauthorised.
  }
  if (password === secret) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lookout", charset="UTF-8"', "Cache-Control": "no-store" }
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
