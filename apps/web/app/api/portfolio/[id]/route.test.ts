import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("@lookout/db",()=>({
 databaseConfigured:vi.fn(()=>true),confirmLogicalProject:vi.fn(),
 confirmAccountProjectStatus:vi.fn(),confirmedProjectStatuses:["building","testing","live"]
}));
vi.mock("../../../../lib/auth/lookout-context",()=>({getLookoutContext:vi.fn()}));
vi.mock("../../../../lib/scan-request",()=>({sameOriginPost:vi.fn(()=>true)}));
import {NextRequest} from "next/server";
import {getLookoutContext} from "../../../../lib/auth/lookout-context";
import {confirmAccountProjectStatus} from "@lookout/db";
import {PATCH} from "./route";
const request=()=>new NextRequest("https://lookout.example/api/portfolio/7",{
 method:"PATCH",headers:{"origin":"https://lookout.example","Content-Type":"application/json"},
 body:JSON.stringify({status:"testing",note:"Checked"})
});
const ctx={params:Promise.resolve({id:"7"})};
describe("project updates honour the signed-in tenant",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("propagates a missing-session redirect without a generic 404",async()=>{
  vi.mocked(getLookoutContext).mockRejectedValue(new Error("NEXT_REDIRECT: sign-in"));
  await expect(PATCH(request(),ctx)).rejects.toThrow("NEXT_REDIRECT");
 });
 it("viewers cannot update projects",async()=>{
  vi.mocked(getLookoutContext).mockResolvedValue({mode:"account",organisationId:2,name:"B",role:"viewer"});
  expect((await PATCH(request(),ctx)).status).toBe(403);
  expect(confirmAccountProjectStatus).not.toHaveBeenCalled();
 });
 it("an account cannot update an ungranted project",async()=>{
  vi.mocked(getLookoutContext).mockResolvedValue({mode:"account",organisationId:2,name:"B",role:"owner"});
  vi.mocked(confirmAccountProjectStatus).mockResolvedValue(false);
  expect((await PATCH(request(),ctx)).status).toBe(404);
  expect(confirmAccountProjectStatus).toHaveBeenCalledWith(2,7,"testing","Checked");
 });
});
