import { consumeOAuthCode, issueOAuthTokens, rotateOAuthRefreshToken, verifyPKCE } from "@lookout/db";
import { NO_STORE, RESOURCE, validClientId } from "../../../lib/chatgpt-oauth";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failure = (error: string, status = 400) => Response.json({ error }, {
  status, headers: NO_STORE
});

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192)
    return failure("invalid_request", 413);
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
    return failure("invalid_request", 415);
  let raw: string;
  try { raw = await request.text(); }
  catch { return failure("invalid_request"); }
  if (raw.length > 8192) return failure("invalid_request", 413);
  const form = new URLSearchParams(raw);
  const grant = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  const resource = form.get("resource") ?? RESOURCE;
  if (!validClientId(clientId) || resource !== RESOURCE) return failure("invalid_client", 401);
  try {
    if (grant === "authorization_code") {
      const code = form.get("code") ?? "";
      const redirectUri = form.get("redirect_uri") ?? "";
      const verifier = form.get("code_verifier") ?? "";
      const consumed = await consumeOAuthCode(code, clientId, redirectUri, resource);
      if (!consumed || !verifyPKCE(verifier, consumed.codeChallenge))
        return failure("invalid_grant");
      return Response.json(await issueOAuthTokens(clientId, resource, consumed.scope), {
        headers: NO_STORE
      });
    }
    if (grant === "refresh_token") {
      const refreshed = await rotateOAuthRefreshToken(form.get("refresh_token") ?? "",
        clientId, resource);
      if (!refreshed) return failure("invalid_grant");
      return Response.json(refreshed, { headers: NO_STORE });
    }
    return failure("unsupported_grant_type");
  } catch (error) {
    console.error("Lookout OAuth token exchange unavailable", error);
    return failure("server_error", 503);
  }
}
