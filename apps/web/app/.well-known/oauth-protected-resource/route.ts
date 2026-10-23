import { ISSUER, RESOURCE, NO_STORE } from "../../../lib/chatgpt-oauth";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["lookout:read", "lookout:contribute", "offline_access"]
  }, { headers: NO_STORE });
}
