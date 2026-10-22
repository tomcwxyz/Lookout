import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { ISSUER, RESOURCE } from "./chatgpt-oauth";

vi.mock("@lookout/db", () => ({
  createOAuthCode: vi.fn(async () => "lk_oac_" + "c".repeat(64))
}));
import { GET, POST } from "../app/oauth/authorize/route";

const clientId = "https://chatgpt.com/oauth/client.json";
const redirect = "https://chatgpt.com/oauth/callback";
const challenge = createHash("sha256").update("a".repeat(64)).digest("base64url");

function req(url: string, init?: RequestInit) {
  const request = new Request(url, init) as NextRequest;
  Object.defineProperty(request, "nextUrl", { value: new URL(url) });
  return request;
}
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LOOKOUT_DASHBOARD_TOKEN;
});

describe("personal OAuth consent", () => {
  it("requires verified ChatGPT client metadata and explicit consent", async () => {
    process.env.LOOKOUT_DASHBOARD_TOKEN = "test-dashboard-login";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      client_id: clientId, redirect_uris: [redirect]
    }), { status: 200 })));
    const query = new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: "code",
      code_challenge: challenge, code_challenge_method: "S256",
      resource: RESOURCE, scope: "lookout:read offline_access", state: "sample-state"
    });
    const page = await GET(req(ISSUER + "/oauth/authorize?" + query));
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Allow read-only access");
    const payload = /name="payload" value="([^"]+)"/.exec(html)?.[1];
    const signature = /name="signature" value="([^"]+)"/.exec(html)?.[1];
    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();
    const body = new URLSearchParams({ payload: payload!, signature: signature!,
      decision: "allow" });
    const deniedOrigin = await POST(req(ISSUER + "/oauth/authorize", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://elsewhere.example" }, body
    }));
    expect(deniedOrigin.status).toBe(403);
    const approved = await POST(req(ISSUER + "/oauth/authorize", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded",
        Origin: ISSUER }, body
    }));
    expect(approved.status).toBe(303);
    const location = new URL(approved.headers.get("Location")!);
    expect(location.origin).toBe("https://chatgpt.com");
    expect(location.searchParams.get("state")).toBe("sample-state");
    expect(location.searchParams.get("iss")).toBe(ISSUER);
    expect(location.searchParams.get("code")).toMatch(/^lk_oac_/);
  });
});
