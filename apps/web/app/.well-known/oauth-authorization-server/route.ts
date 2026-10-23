import { ISSUER, NO_STORE } from "../../../lib/chatgpt-oauth";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({
    issuer: ISSUER,
    authorization_endpoint: ISSUER + "/oauth/authorize",
    token_endpoint: ISSUER + "/oauth/token",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    scopes_supported: ["lookout:read", "lookout:contribute", "offline_access"],
    authorization_response_iss_parameter_supported: true
  }, { headers: NO_STORE });
}
