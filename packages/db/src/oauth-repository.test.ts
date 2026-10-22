import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPKCE } from "./oauth-repository";

describe("OAuth S256 PKCE", () => {
  it("accepts matching verifier and rejects mismatches", () => {
    const verifier = "a".repeat(64);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPKCE(verifier, challenge)).toBe(true);
    expect(verifyPKCE("b".repeat(64), challenge)).toBe(false);
    expect(verifyPKCE("short", challenge)).toBe(false);
    expect(verifyPKCE(verifier, "invalid")).toBe(false);
  });
});
