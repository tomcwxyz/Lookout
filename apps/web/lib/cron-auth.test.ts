import { describe, expect, it } from "vitest";
import { cronAuthorised } from "./cron-auth";

describe("scheduled observation access", () => {
  const secret = "this-is-a-long-random-like-test-secret-1234";
  it("rejects absent, short, and incorrect secrets", () => {
    expect(cronAuthorised(null, secret)).toBe(false);
    expect(cronAuthorised("Bearer undefined", undefined)).toBe(false);
    expect(cronAuthorised("Bearer short", "short")).toBe(false);
    expect(cronAuthorised("Basic " + secret, secret)).toBe(false);
    expect(cronAuthorised("Bearer other", secret)).toBe(false);
  });
  it("accepts only exact bearer authentication", () => {
    expect(cronAuthorised("Bearer " + secret, secret)).toBe(true);
  });
});
