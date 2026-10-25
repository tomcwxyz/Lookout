import { createMcpHandler } from "@modelcontextprotocol/server";
import type { NextRequest } from "next/server";
import { authoriseHostedMcp } from "../../../lib/hosted-mcp-auth";
import { createHostedMcpServer } from "../../../lib/hosted-mcp";
import { createOrganisationMcpServer } from "../../../lib/organisation-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const noStore = { "Cache-Control": "no-store" };
const unauthorised = () => new Response(JSON.stringify({ error: "Lookout MCP authentication required" }), {
  status: 401, headers: { ...noStore, "Content-Type": "application/json",
    "WWW-Authenticate": 'Bearer realm="Lookout MCP", resource_metadata="https://lookout-eosin.vercel.app/.well-known/oauth-protected-resource"' }
});

/** Stateless, read-only Streamable HTTP MCP. Every request gets its own verified identity. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new Response("Cross-origin MCP request rejected", { status: 403, headers: noStore });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 65536) {
    return new Response("MCP request too large", { status: 413, headers: noStore });
  }
  let identity;
  try { identity = await authoriseHostedMcp(request.headers.get("authorization")); }
  catch (error) {
    console.error("Lookout MCP authentication backend unavailable", error);
    return new Response("MCP authentication unavailable", { status: 503, headers: noStore });
  }
  if (!identity) return unauthorised();
  let body: string;
  try { body = await request.text(); }
  catch { return new Response("Invalid request body", { status: 400, headers: noStore }); }
  if (Buffer.byteLength(body, "utf8") > 65536)
    return new Response("MCP request too large", { status: 413, headers: noStore });

  const handler = createMcpHandler(() => identity.scope === "organisation"
    ? createOrganisationMcpServer(identity) : createHostedMcpServer(identity), { responseMode: "json" });
  try {
    const upstream = new Request(request.url, {
      method: "POST", headers: request.headers, body
    });
    const response = await handler.fetch(upstream);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error("Lookout hosted MCP request failed", error);
    return new Response(JSON.stringify({ error: "Lookout MCP temporarily unavailable" }), {
      status: 500, headers: { ...noStore, "Content-Type": "application/json" }
    });
  } finally {
    await handler.close();
  }
}
export function GET() { return new Response("No streaming session", { status: 405, headers: noStore }); }
export function DELETE() { return new Response("No session to delete", { status: 405, headers: noStore }); }
