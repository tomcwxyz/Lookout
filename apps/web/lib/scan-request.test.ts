import { describe, expect, it } from "vitest";
import { sameOriginPost } from "./scan-request";

describe("manual scan CSRF protection", () => {
  it("allows the matching origin", () => {
    expect(sameOriginPost("https://lookout.example", "https://lookout.example")).toBe(true);
  });
  it("rejects missing and cross-origin requests", () => {
    expect(sameOriginPost(null, "https://lookout.example")).toBe(false);
    expect(sameOriginPost("https://evil.example", "https://lookout.example")).toBe(false);
    expect(sameOriginPost("http://lookout.example", "https://lookout.example")).toBe(false);
    expect(sameOriginPost("https://lookout.example.evil", "https://lookout.example")).toBe(false);
  });
});
