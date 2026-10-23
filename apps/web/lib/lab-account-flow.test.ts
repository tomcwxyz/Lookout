import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("@lookout/db",()=>({
 listVerifiedIdentityOrganisations:vi.fn(),
 resolveOrganisationMember:vi.fn(async(_issuer:string,_subject:string,org:number)=>org===1?{organisationId:1,userId:11,role:"owner"}:null),
 listTenantPortfolioProjects:vi.fn(async(org:number)=>org===1?[{id:1,name:"A",status:null}]:[])
}));
vi.mock("./auth/lab-server",()=>({getLabIdentity:vi.fn()}));
import {getLabIdentity} from "./auth/lab-server";
import {listVerifiedIdentityOrganisations} from "@lookout/db";
import {verifiedWorkspaceProjects} from "./verified-workspace";
describe("isolated account workspace integration",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("requires server-verified identity for listing",async()=>{
  vi.mocked(getLabIdentity).mockResolvedValue(null);
  expect(await getLabIdentity()).toBeNull();
  expect(listVerifiedIdentityOrganisations).not.toHaveBeenCalled();
 });
 it("rejects cross-organisation selection",async()=>{
  expect(await verifiedWorkspaceProjects(async()=>({issuer:"https://auth.example.test",subject:"user-a",authenticated:true}),2)).toBeNull();
 });
 it("allows only the signed-in member's existing organisation",async()=>{
  const r=await verifiedWorkspaceProjects(async()=>({issuer:"https://auth.example.test",subject:"user-a",authenticated:true}),1);
  expect(r?.projects).toEqual([{id:1,name:"A",status:null}]);
 });
});
