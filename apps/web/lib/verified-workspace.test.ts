import { describe,it,expect,vi,beforeEach } from "vitest";
vi.mock("@lookout/db",()=>({
 resolveOrganisationMember:vi.fn(async (_issuer:string,subject:string,org:number)=>subject==="user-A"&&org===1?{organisationId:1,userId:11,role:"member"}:null),
 authorisedPortfolioProject:vi.fn(async (org:number,id:number)=>org===1&&id===101?{id:101,name:"Private A",status:null}:null),
 listTenantPortfolioProjects:vi.fn(async (org:number)=>org===1?[{id:101,name:"Private A",status:null}]:[])
}));
import {verifiedWorkspace,verifiedProjectRead,verifiedWorkspaceProjects} from "./verified-workspace";
import {resolveOrganisationMember,authorisedPortfolioProject} from "@lookout/db";
const accountA=async()=>({issuer:"https://auth.example.test",subject:"user-A",authenticated:true as const});
describe("verified session workspace gates",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("fails closed when no server-verified session",async()=>{
  expect(await verifiedWorkspace(async()=>null,1)).toBeNull();
  expect(resolveOrganisationMember).not.toHaveBeenCalled();
 });
 it("does not infer access from a caller-supplied organisation",async()=>{
  expect(await verifiedWorkspace(accountA,2)).toBeNull();
  expect(await verifiedWorkspaceProjects(accountA,2)).toBeNull();
 });
 it("requires BOTH verified membership and explicit project link",async()=>{
  expect((await verifiedProjectRead(accountA,1,101))?.project.name).toBe("Private A");
  expect(await verifiedProjectRead(accountA,1,202)).toBeNull();
  expect(await verifiedProjectRead(async()=>({issuer:"https://auth.example.test",subject:"user-B",authenticated:true}),1,101)).toBeNull();
 });
 it("rejects invalid org and malformed session identities before database lookup",async()=>{
  expect(await verifiedWorkspace(accountA,-1)).toBeNull();
  expect(await verifiedWorkspace(async()=>({issuer:"http://forged",subject:"user-A",authenticated:true}),1)).toBeNull();
  expect(resolveOrganisationMember).not.toHaveBeenCalled();
  expect(authorisedPortfolioProject).not.toHaveBeenCalled();
 });
});