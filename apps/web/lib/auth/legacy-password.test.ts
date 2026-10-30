import { describe, expect, it } from "vitest";
import { legacyRecoveryConfigured, validLegacyRecoveryPassword } from "./legacy-password";

describe("legacy Lookout portfolio recovery", () => {
  it("recognises an existing short admin credential rather than calling it unconfigured", () => {
    expect(legacyRecoveryConfigured("oldpass")).toBe(true);
    expect(validLegacyRecoveryPassword("oldpass", "oldpass")).toBe(true);
  });
  it("accepts long original credentials, including Unicode characters", () => {
    expect(validLegacyRecoveryPassword("earlier-password-✓", "earlier-password-✓")).toBe(true);
  });
  it("rejects empty, absent, wrong and oversized submissions", () => {
    expect(legacyRecoveryConfigured(undefined)).toBe(false);
    expect(legacyRecoveryConfigured("")).toBe(false);
    expect(validLegacyRecoveryPassword("", "")).toBe(false);
    expect(validLegacyRecoveryPassword("oldpass", undefined)).toBe(false);
    expect(validLegacyRecoveryPassword("oldpass", "other")).toBe(false);
    expect(validLegacyRecoveryPassword("oldpas", "oldpass")).toBe(false);
    expect(validLegacyRecoveryPassword("x".repeat(1025), "x".repeat(1025))).toBe(false);
  });
});
