import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

describe("lab authentication middleware", () => {
 it("allows the lab API to enforce its own bearer verification", () => {
  const request=new NextRequest("https://lookout.example/api/lab/workspace");
  const response=middleware(request);
  expect(response.status).toBe(200);
  expect(response.headers.get("www-authenticate")).toBeNull();
 });
 it("does not open normal dashboard routes without Basic authentication", () => {
  const prior=process.env.LOOKOUT_DASHBOARD_TOKEN;
  process.env.LOOKOUT_DASHBOARD_TOKEN="test-dashboard-password";
  try {
   const request=new NextRequest("https://lookout.example/portfolio");
   const response=middleware(request);
   expect(response.status).toBe(401);
  } finally {
   if(prior===undefined)delete process.env.LOOKOUT_DASHBOARD_TOKEN;
   else process.env.LOOKOUT_DASHBOARD_TOKEN=prior;
  }
 });
});
