import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("@lookout/db",()=>({
 listVerifiedIdentityOrganisations:vi.fn(),
 onboardVerifiedIdentity:vi.fn()
}));
vi.mock("./auth/lab-server",()=>({getLabIdentity:vi.fn()}));
import {getLabIdentity} from "./auth/lab-server";
import {listVerifiedIdentityOrganisations} from "@lookout/db";
import {verifiedWorkspaceProjects} from "./verified-workspace";
vi.mock("@lookout/db",async importOriginal=>{
 const actual=await importOriginal<typeof import("@lookout/db")>();
 return {...actual,listVerifiedIdentityOrganisations:vi.fn(),resolveOrganisationMember:vi.fn(async(_i,_s,org)=>org===1?{organisationId:1,userId:11,role:"owner"}:null),
 listTenantPortfolioProjects:vi.fn(async org=>org===1?[{id:1,name:"A",status:null}]:[])};
});
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
});
