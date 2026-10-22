import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { RESOURCE } from "./chatgpt-oauth";

vi.mock("@lookout/db", () => ({
  consumeOAuthCode: vi.fn(async (code: string) =>
    code === "lk_oac_" + "a".repeat(64)
      ? { codeChallenge: "c".repeat(43), scope: "lookout:read offline_access" } : null),
  verifyPKCE: vi.fn((verifier: string, challenge: string) =>
    verifier === "v".repeat(64) && challenge === "c".repeat(43)),
  issueOAuthTokens: vi.fn(async () => ({
    access_token: "lk_oat_" + "a".repeat(64),
    refresh_token: "lk_ort_" + "b".repeat(64),
    token_type: "Bearer", expires_in: 3600, scope: "lookout:read offline_access"
  })),
  rotateOAuthRefreshToken: vi.fn(async (raw: string) =>
    raw === "lk_ort_" + "b".repeat(64)
      ? { access_token: "lk_oat_" + "c".repeat(64), token_type: "Bearer",
          refresh_token: "lk_ort_" + "d".repeat(64), expires_in: 3600 } : null)
}));
import { POST } from "../app/oauth/token/route";

const client = "https://chatgpt.com/oauth/client.json";
async function send(params: Record<string, string>) {
  const url = "https://lookout-eosin.vercel.app/oauth/token";
  const request = new Request(url, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client, resource: RESOURCE, ...params })
  }) as NextRequest;
  return POST(request);
}
describe("ChatGPT OAuth token exchange", () => {
  it("requires valid one-time code and PKCE verifier", async () => {
    const good = await send({ grant_type: "authorization_code",
      code: "lk_oac_" + "a".repeat(64), code_verifier: "v".repeat(64),
      redirect_uri: "https://chatgpt.com/oauth/callback" });
    expect(good.status).toBe(200);
    const body = await good.json();
    expect(body.token_type).toBe("Bearer");
    expect(body.refresh_token).toMatch(/^lk_ort_/);
    const bad = await send({ grant_type: "authorization_code",
      code: "lk_oac_" + "a".repeat(64), code_verifier: "invalid",
      redirect_uri: "https://chatgpt.com/oauth/callback" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_grant");
  });
  it("rotates refresh tokens and rejects an unknown client", async () => {
    const refresh = await send({ grant_type: "refresh_token",
      refresh_token: "lk_ort_" + "b".repeat(64) });
    expect(refresh.status).toBe(200);
    expect((await refresh.json()).access_token).toMatch(/^lk_oat_/);
    const invalid = await send({ grant_type: "refresh_token", client_id: "https://elsewhere.example",
      refresh_token: "lk_ort_" + "b".repeat(64) });
    expect(invalid.status).toBe(401);
  });
});
