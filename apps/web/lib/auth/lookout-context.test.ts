import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers",()=>({headers:vi.fn(),cookies:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn((target:string)=>{throw new Error("REDIRECT:"+target);})}));
vi.mock("./lab-server",()=>({getLabIdentity:vi.fn()}));
vi.mock("@lookout/db",()=>({listVerifiedIdentityOrganisations:vi.fn()}));

import { headers, cookies } from "next/headers";
import { getLabIdentity } from "./lab-server";
import { listVerifiedIdentityOrganisations } from "@lookout/db";
import { getLookoutContext } from "./lookout-context";

const originalFlag=process.env.LOOKOUT_MULTIUSER_LAB;
const originalPassword=process.env.LOOKOUT_DASHBOARD_TOKEN;
const verified={issuer:"https://auth.example.test",subject:"user-1",email:"first@example.test",emailVerified:false,name:"Tester",authenticated:true as const};

describe("Lookout's shared account boundary",()=>{
 beforeEach(()=>{
  vi.clearAllMocks();process.env.LOOKOUT_MULTIUSER_LAB="enabled";
  process.env.LOOKOUT_DASHBOARD_TOKEN="test-password";
  vi.mocked(headers).mockResolvedValue({get:()=>null} as never);
  vi.mocked(cookies).mockResolvedValue({get:()=>undefined} as never);
  vi.mocked(getLabIdentity).mockResolvedValue(verified);
  vi.mocked(listVerifiedIdentityOrganisations).mockResolvedValue([{id:7,slug:"team-a",name:"Team A",role:"owner"}]);
 });
 afterEach(()=>{
  if(originalFlag===undefined)delete process.env.LOOKOUT_MULTIUSER_LAB;else process.env.LOOKOUT_MULTIUSER_LAB=originalFlag;
  if(originalPassword===undefined)delete process.env.LOOKOUT_DASHBOARD_TOKEN;else process.env.LOOKOUT_DASHBOARD_TOKEN=originalPassword;
 });
 it("preserves legacy mode when the multi-user feature is off",async()=>{
  delete process.env.LOOKOUT_MULTIUSER_LAB;
  expect(await getLookoutContext()).toEqual({mode:"legacy"});
  expect(getLabIdentity).not.toHaveBeenCalled();
 });
 it("keeps existing valid Basic auth in the original application",async()=>{
  const value="Basic "+Buffer.from("lookout:test-password").toString("base64");
  vi.mocked(headers).mockResolvedValue({get:()=>value} as never);
  expect(await getLookoutContext()).toEqual({mode:"legacy"});
  expect(getLabIdentity).not.toHaveBeenCalled();
 });
 it("denies unauthenticated requests to the original dashboard",async()=>{
  vi.mocked(getLabIdentity).mockResolvedValue(null);
  await expect(getLookoutContext()).rejects.toThrow("REDIRECT:/auth/sign-in");
 });
 it("never trusts an organisation cookie without membership",async()=>{
  vi.mocked(cookies).mockResolvedValue({get:()=>({value:"888"})} as never);
  await expect(getLookoutContext()).rejects.toThrow("REDIRECT:/lab");
 });
 it("automatically enters the single organisation already assigned to a signed-in user",async()=>{
  expect(await getLookoutContext()).toEqual({mode:"account",organisationId:7,name:"Team A",role:"owner"});
 });
 it("requires selection when an account belongs to multiple organisations",async()=>{
  vi.mocked(listVerifiedIdentityOrganisations).mockResolvedValue([
   {id:7,slug:"team-a",name:"Team A",role:"owner"},
   {id:8,slug:"team-b",name:"Team B",role:"viewer"}
  ]);
  await expect(getLookoutContext()).rejects.toThrow("REDIRECT:/lab");
  vi.mocked(cookies).mockResolvedValue({get:()=>({value:"8"})} as never);
  expect(await getLookoutContext()).toEqual({mode:"account",organisationId:8,name:"Team B",role:"viewer"});
 });
});
