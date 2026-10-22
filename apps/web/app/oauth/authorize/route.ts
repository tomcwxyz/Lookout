import { createOAuthCode } from "@lookout/db";
import type { NextRequest } from "next/server";
import {
  ISSUER, NO_STORE, escapeHtml, oauthRedirect, signConsent, validateAuthorizationParams,
  validateChatGPTClient, verifyConsent, sameOriginConsentPost
} from "../../../lib/chatgpt-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const htmlHeaders = { ...NO_STORE, "Content-Type": "text/html; charset=utf-8",
  // Chrome enforces form-action across 303 redirects. Permit only Lookout and the
  // verified ChatGPT callback origin; the callback URI itself is metadata-validated.
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://chatgpt.com; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "origin" };

function error(message: string, status = 400) {
  return new Response(message, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const params = validateAuthorizationParams(request.nextUrl.searchParams);
  if (!params) return error("Invalid OAuth request. ChatGPT must request authorisation with S256 PKCE.");
  if (!process.env.LOOKOUT_DASHBOARD_TOKEN) return error("Lookout dashboard login unavailable", 503);
  if (!await validateChatGPTClient(params.clientId, params.redirectUri))
    return error("ChatGPT client metadata or callback could not be verified.");
  const { encoded, signature } = signConsent(params, process.env.LOOKOUT_DASHBOARD_TOKEN);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect ChatGPT to Lookout</title>
<style>body{font:16px system-ui,sans-serif;background:#f5f8f6;color:#16342b;margin:0}
main{max-width:520px;margin:8vh auto;background:white;border:1px solid #d7e4dc;
border-radius:18px;padding:32px;box-shadow:0 10px 32px #152a2014}
h1{font-size:1.65rem;margin:0 0 12px}p{line-height:1.55}
.small{font-size:13px;color:#52665b}button{background:#164c38;color:white;border:0;
padding:13px 20px;border-radius:9px;font:inherit;cursor:pointer}
.secondary{background:#e7eeea;color:#164c38}form{display:inline-block;margin:8px 8px 0 0}
</style></head><body><main>
<p class="small">LOOKOUT / PRIVATE CONNECTION</p>
<h1>Allow ChatGPT to read Lookout?</h1>
<p>ChatGPT is requesting <strong>read-only access to your observed project portfolio</strong>,
including attention items, project handovers and infrastructure summaries.</p>
<p>This does not permit ChatGPT to change projects, merge code or submit agent checkpoints.</p>
<p class="small">You are signed in with your existing Lookout dashboard credentials.
Access tokens expire after one hour and can be refreshed for up to 30 days.</p>
<form method="post" action="/oauth/authorize">
<input type="hidden" name="payload" value="${escapeHtml(encoded)}">
<input type="hidden" name="signature" value="${escapeHtml(signature)}">
<button type="submit" name="decision" value="allow">Allow read-only access</button>
<button type="submit" class="secondary" name="decision" value="deny">Cancel</button>
</form></main></body></html>`;
  return new Response(html, { status: 200, headers: htmlHeaders });
}

export async function POST(request: NextRequest) {
  if (!sameOriginConsentPost(request.headers)) return error("Invalid request origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
    return error("Invalid form", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 12000)
    return error("Request too large", 413);
  const text = await request.text();
  if (text.length > 12000) return error("Request too large", 413);
  const form = new URLSearchParams(text);
  const secret = process.env.LOOKOUT_DASHBOARD_TOKEN ?? "";
  const params = verifyConsent(form.get("payload") ?? "", form.get("signature") ?? "", secret);
  if (!params) return error("Consent request expired or invalid", 400);
  const base = { state: params.state, iss: ISSUER };
  if (form.get("decision") !== "allow")
    return Response.redirect(oauthRedirect(params.redirectUri,
      { ...base, error: "access_denied" }), 303);
  try {
    const code = await createOAuthCode({
      clientId: params.clientId, redirectUri: params.redirectUri,
      codeChallenge: params.challenge, resource: params.resource, scope: params.scope
    });
    return new Response(null, { status: 303, headers: {
      ...NO_STORE, Location: oauthRedirect(params.redirectUri, { ...base, code })
    } });
  } catch (cause) {
    console.error("Lookout OAuth authorisation unavailable", cause);
    return error("Unable to authorise Lookout", 503);
  }
}
