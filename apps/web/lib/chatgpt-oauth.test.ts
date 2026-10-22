import { createHash } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  RESOURCE, validClientId, validateAuthorizationParams, validateChatGPTClient,
  signConsent, verifyConsent, sameOriginConsentPost
} from "./chatgpt-oauth";

afterEach(() => vi.unstubAllGlobals());

describe("ChatGPT OAuth security", () => {
  it("allows browser same-origin consent without Origin but blocks cross-site posts", () => {
    expect(sameOriginConsentPost(new Headers({
      "sec-fetch-site": "same-origin"
    }))).toBe(true);
    expect(sameOriginConsentPost(new Headers({
      "referer": "https://lookout-eosin.vercel.app/oauth/authorize"
    }))).toBe(true);
    expect(sameOriginConsentPost(new Headers({
      "origin": "https://lookout-eosin.vercel.app",
      "sec-fetch-site": "same-origin"
    }))).toBe(true);
    expect(sameOriginConsentPost(new Headers({
      "origin": "https://elsewhere.example",
      "sec-fetch-site": "cross-site"
    }))).toBe(false);
    expect(sameOriginConsentPost(new Headers({
      "origin": "null", "sec-fetch-site": "cross-site"
    }))).toBe(false);
    expect(sameOriginConsentPost(new Headers({
      "referer": "https://lookout-eosin.vercel.app.attacker.example/authorize"
    }))).toBe(false);
    expect(sameOriginConsentPost(new Headers())).toBe(false);
  });
  const clientId = "https://chatgpt.com/oauth/client.json";
  const redirect = "https://chatgpt.com/oauth/callback";
  const challenge = createHash("sha256").update("A".repeat(64)).digest("base64url");
  function params() {
    return new URLSearchParams({ client_id: clientId, redirect_uri: redirect,
      response_type: "code", code_challenge_method: "S256",
      code_challenge: challenge, state: "state-123", resource: RESOURCE,
      scope: "lookout:read offline_access" });
  }
  it("only allows the ChatGPT metadata origin", () => {
    expect(validClientId(clientId)).toBe(true);
    expect(validClientId("https://chatgpt.com/oauth/1234/client.json")).toBe(true);
    expect(validClientId("https://elsewhere.example/oauth/client.json")).toBe(false);
  });
  it("requires PKCE and correct resource and scope", () => {
    const p = params();
    expect(validateAuthorizationParams(p)?.clientId).toBe(clientId);
    p.set("code_challenge_method", "plain");
    expect(validateAuthorizationParams(p)).toBeNull();
    p.set("code_challenge_method", "S256");
    p.set("resource", "https://elsewhere.example/api/mcp");
    expect(validateAuthorizationParams(p)).toBeNull();
    p.set("resource", RESOURCE);
    p.set("scope", "lookout:write");
    expect(validateAuthorizationParams(p)).toBeNull();
  });
  it("validates registered callback against client metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      client_id: clientId, redirect_uris: [redirect]
    }), { status: 200 })));
    expect(await validateChatGPTClient(clientId, redirect)).toBe(true);
    expect(await validateChatGPTClient(clientId, "https://chatgpt.com/other")).toBe(false);
  });
  it("rejects modified or expired consent", () => {
    const payload = validateAuthorizationParams(params())!;
    const signed = signConsent(payload, "local-test-key");
    expect(verifyConsent(signed.encoded, signed.signature, "local-test-key")?.state).toBe("state-123");
    expect(verifyConsent(signed.encoded, signed.signature, "different-key")).toBeNull();
    const expired = signConsent({ ...payload, expires: Date.now() - 1000 }, "local-test-key");
    expect(verifyConsent(expired.encoded, expired.signature, "local-test-key")).toBeNull();
  });
});
