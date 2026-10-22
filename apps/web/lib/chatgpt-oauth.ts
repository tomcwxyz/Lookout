import { createHmac, timingSafeEqual } from "node:crypto";

export const ISSUER = "https://lookout-eosin.vercel.app";
export const RESOURCE = ISSUER + "/api/mcp";
export const SCOPE = "lookout:read offline_access";

export type ConsentPayload = {
  clientId: string; redirectUri: string; challenge: string; scope: string;
  state: string; resource: string; expires: number;
};

export function validClientId(id: string): boolean {
  return /^https:\/\/chatgpt\.com\/oauth\/(?:client\.json|[A-Za-z0-9_-]{1,128}\/client\.json)$/.test(id);
}

export async function validateChatGPTClient(clientId: string, redirectUri: string) {
  if (!validClientId(clientId)) return false;
  let url: URL;
  try { url = new URL(redirectUri); } catch { return false; }
  if (url.protocol !== "https:" || url.hostname !== "chatgpt.com" || url.port || url.username || url.password)
    return false;
  try {
    const response = await fetch(clientId, {
      cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" }
    });
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 16384)
      return false;
    const body = await response.text();
    if (body.length > 16384) return false;
    const data = JSON.parse(body) as { client_id?: unknown; redirect_uris?: unknown };
    return data.client_id === clientId
      && Array.isArray(data.redirect_uris)
      && data.redirect_uris.includes(redirectUri);
  } catch { return false; }
}

export function validateAuthorizationParams(params: URLSearchParams): ConsentPayload | null {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const challenge = params.get("code_challenge") ?? "";
  const state = params.get("state") ?? "";
  const resource = params.get("resource") ?? RESOURCE;
  const scope = params.get("scope") || SCOPE;
  if (params.get("response_type") !== "code" || !validClientId(clientId)
    || !/^https:\/\/chatgpt\.com\//.test(redirectUri)
    || params.get("code_challenge_method") !== "S256"
    || !/^[A-Za-z0-9_-]{43}$/.test(challenge)
    || !state || state.length > 2048 || resource !== RESOURCE
    || !scope.split(/\s+/).every(x => x === "lookout:read" || x === "offline_access")
    || !scope.split(/\s+/).includes("lookout:read")) return null;
  return { clientId, redirectUri, challenge, state, resource, scope,
    expires: Date.now() + 10 * 60 * 1000 };
}

export function signConsent(payload: ConsentPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { encoded, signature };
}

export function verifyConsent(encoded: string, signature: string, secret: string): ConsentPayload | null {
  if (!encoded || encoded.length > 8000 || !signature || !secret) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  if (signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString()) as ConsentPayload;
    if (!value || typeof value.expires !== "number" || value.expires < Date.now()
      || value.expires > Date.now() + 11 * 60 * 1000
      || !validClientId(value.clientId) || value.resource !== RESOURCE
      || !/^[A-Za-z0-9_-]{43}$/.test(value.challenge)
      || !value.state || value.state.length > 2048) return null;
    const url = new URL(value.redirectUri);
    if (url.origin !== "https://chatgpt.com") return null;
    return value;
  } catch { return null; }
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

export function oauthRedirect(uri: string, params: Record<string, string>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export const NO_STORE = { "Cache-Control": "no-store", "Pragma": "no-cache" };
