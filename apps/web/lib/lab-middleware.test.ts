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
 it("routes account pages to their server-side session guard but never opens provider controls",()=>{
   const oldLab=process.env.LOOKOUT_MULTIUSER_LAB;
   const oldToken=process.env.LOOKOUT_DASHBOARD_TOKEN;
   process.env.LOOKOUT_MULTIUSER_LAB="enabled";
   process.env.LOOKOUT_DASHBOARD_TOKEN="test-dashboard-password";
   try {
     for(const path of ["/","/portfolio","/portfolio/1","/projects/1","/agents","/infrastructure","/connections","/workspace/1/activate","/api/portfolio/1"]){
       const response=middleware(new NextRequest("https://lookout.example"+path));
       expect(response.status,path).toBe(200);
     }
     for(const path of ["/api/scan/github","/api/portfolio/assign","/api/oauth/revoke"]){
       const response=middleware(new NextRequest("https://lookout.example"+path));
       expect(response.status,path).toBe(401);
     }
   } finally {
     if(oldLab===undefined)delete process.env.LOOKOUT_MULTIUSER_LAB;
     else process.env.LOOKOUT_MULTIUSER_LAB=oldLab;
     if(oldToken===undefined)delete process.env.LOOKOUT_DASHBOARD_TOKEN;
     else process.env.LOOKOUT_DASHBOARD_TOKEN=oldToken;
   }
 });
});
