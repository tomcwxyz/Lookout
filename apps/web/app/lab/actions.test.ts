import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLabOrganisation } from "./actions";
import { getLabIdentity } from "../../lib/auth/lab-server";
import { onboardVerifiedIdentity } from "@lookout/db";

vi.mock("../../lib/auth/lab-server", () => ({
  getLabIdentity: vi.fn(),
}));
vi.mock("@lookout/db", () => ({
  onboardVerifiedIdentity: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error("REDIRECT:" + url); }),
}));

const originalFlag = process.env.LOOKOUT_MULTIUSER_LAB;
const newForm = () => {
  const data = new FormData();
  data.set("name", "Test Organisation");
  data.set("slug", "test-organisation");
  // A browser cannot inject or override the authenticated account identity.
  data.set("email", "attacker@example.com");
  data.set("subject", "attacker");
  return data;
};

describe("lab organisation onboarding without email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOOKOUT_MULTIUSER_LAB = "enabled";
  });
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.LOOKOUT_MULTIUSER_LAB;
    else process.env.LOOKOUT_MULTIUSER_LAB = originalFlag;
  });
  it("requires the lab feature flag", async () => {
    delete process.env.LOOKOUT_MULTIUSER_LAB;
    await expect(createLabOrganisation(newForm())).rejects.toThrow("Not available");
    expect(onboardVerifiedIdentity).not.toHaveBeenCalled();
  });
  it("requires a server-verified signed-in session", async () => {
    vi.mocked(getLabIdentity).mockResolvedValue(null);
    await expect(createLabOrganisation(newForm())).rejects.toThrow("Sign in");
    expect(onboardVerifiedIdentity).not.toHaveBeenCalled();
  });
  it("accepts a signed-in account with an unverified email while using only session identity", async () => {
    vi.mocked(getLabIdentity).mockResolvedValue({
      issuer: "https://auth.example.test",
      subject: "neon-user-1",
      email: "real@example.com",
      emailVerified: false,
      name: "New user",
      authenticated: true,
    });
    vi.mocked(onboardVerifiedIdentity).mockResolvedValue({ userId: 2, organisationId: 5, role: "owner" });
    await expect(createLabOrganisation(newForm())).rejects.toThrow("REDIRECT:/workspace/5/activate");
    expect(onboardVerifiedIdentity).toHaveBeenCalledWith({
      issuer: "https://auth.example.test",
      subject: "neon-user-1",
      verifiedEmail: "real@example.com",
      organisationName: "Test Organisation",
      organisationSlug: "test-organisation",
    });
  });
  it("normalises names and workspace addresses without trusting a posted identity", async () => {
    vi.mocked(getLabIdentity).mockResolvedValue({
      issuer: "https://auth.example.test", subject: "neon-user-1",
      email: "real@example.com", emailVerified: false,
      name: "User", authenticated: true,
    });
    vi.mocked(onboardVerifiedIdentity).mockResolvedValue({ userId: 2, organisationId: 5, role: "owner" });
    const form = newForm();
    form.set("name", "  Good Ship  ");
    form.set("slug", "  Good Ship  ");
    await expect(createLabOrganisation(form)).rejects.toThrow("REDIRECT:/workspace/5/activate");
    expect(onboardVerifiedIdentity).toHaveBeenCalledWith(expect.objectContaining({
      organisationName: "Good Ship", organisationSlug: "good-ship",
      issuer: "https://auth.example.test", subject: "neon-user-1",
      verifiedEmail: "real@example.com"
    }));
  });
  it("rejects a blank or too-short organisation without calling onboarding", async () => {
    vi.mocked(getLabIdentity).mockResolvedValue({
      issuer: "https://auth.example.test", subject: "neon-user-1",
      email: "real@example.com", emailVerified: false,
      name: "User", authenticated: true,
    });
    const form = newForm();
    form.set("name", " ");
    await expect(createLabOrganisation(form)).rejects.toThrow("REDIRECT:/lab?error=invalid");
    expect(onboardVerifiedIdentity).not.toHaveBeenCalled();
  });

});
