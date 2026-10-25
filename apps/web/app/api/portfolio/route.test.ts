import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("@lookout/db",()=>({
 databaseConfigured:vi.fn(()=>true),createLogicalProject:vi.fn(),createAccountProject:vi.fn(),
 confirmLogicalProject:vi.fn(),confirmAccountProjectStatus:vi.fn(),
 confirmedProjectStatuses:["testing","building","live"]
}));
vi.mock("../../../lib/auth/lookout-context",()=>({getLookoutContext:vi.fn()}));
vi.mock("../../../../lib/auth/lookout-context",()=>({getLookoutContext:vi.fn()}));
vi.mock("../../../lib/scan-request",()=>({sameOriginPost:vi.fn(()=>true)}));
vi.mock("../../../../lib/scan-request",()=>({sameOriginPost:vi.fn(()=>true)}));
import {NextRequest} from "next/server";
import {getLookoutContext} from "../../../lib/auth/lookout-context";
import {POST} from "./route";
import {createAccountProject} from "@lookout/db";
const request=()=>new NextRequest("https://lookout.example/api/portfolio",{
 method:"POST",headers:{"origin":"https://lookout.example","Content-Type":"application/json"},
 body:JSON.stringify({name:"New project"})
});
describe("original portfolio API account authorization",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("propagates the authentication redirect instead of turning it into a 500",async()=>{
  vi.mocked(getLookoutContext).mockRejectedValue(new Error("NEXT_REDIRECT: sign-in"));
  await expect(POST(request())).rejects.toThrow("NEXT_REDIRECT");
  expect(createAccountProject).not.toHaveBeenCalled();
 });
 it("blocks organisation viewers without touching global or tenant projects",async()=>{
  vi.mocked(getLookoutContext).mockResolvedValue({
   mode:"account",organisationId:55,name:"Another organisation",role:"viewer"
  });
  const response=await POST(request());
  expect(response.status).toBe(403);
  expect(createAccountProject).not.toHaveBeenCalled();
 });
 it("uses only the resolved server-side organisation ID when creating",async()=>{
  vi.mocked(getLookoutContext).mockResolvedValue({
   mode:"account",organisationId:9,name:"Good Ship",role:"owner"
  });
  vi.mocked(createAccountProject).mockResolvedValue(123);
  const response=await POST(request());
  expect(response.status).toBe(201);
  expect(createAccountProject).toHaveBeenCalledWith(9,"New project",undefined);
 });
});
