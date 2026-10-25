import {beforeEach,describe,expect,it,vi} from "vitest";
const handlers=new Map<string,(args:unknown)=>Promise<unknown>>();
vi.mock("@modelcontextprotocol/server",()=>({
 McpServer:class {
  registerTool(name:string,_options:unknown,handler:(args:unknown)=>Promise<unknown>){handlers.set(name,handler)}
 }
}));
vi.mock("@lookout/db",()=>({
 listTenantPortfolioProjects:vi.fn(async(org:number)=>[{id:1,name:"Allowed",status:"testing",org}]),
 authorisedPortfolioProject:vi.fn(async(org:number,id:number)=>org===4&&id===1?{id:1,name:"Allowed",status:"testing"}:null),
 listOrganisationMcpFindings:vi.fn(async(org:number)=>[{project:"Allowed",organisationId:org}]),
 listWorkspaceReports:vi.fn(async(org:number)=>[{projectName:"Allowed",organisationId:org}])
}));
import {authorisedPortfolioProject,listTenantPortfolioProjects,listOrganisationMcpFindings,listWorkspaceReports} from "@lookout/db";
import {createOrganisationMcpServer} from "./organisation-mcp";
const identity={scope:"organisation" as const,organisationId:4,connectionId:33,userId:7,name:"Good Ship"};
describe("organisation MCP tools",()=>{
 beforeEach(()=>{vi.clearAllMocks();handlers.clear();createOrganisationMcpServer(identity)});
 it("exposes a small read-only toolset with no contribution/write endpoints",()=>{
  expect([...handlers.keys()].sort()).toEqual([
   "lookout_get_portfolio_project","lookout_list_agent_reports","lookout_list_attention",
   "lookout_list_projects","lookout_whoami"
  ]);
  expect([...handlers.keys()].join(" ")).not.toMatch(/submit|record|write|delete|revoke/);
 });
 it("uses the organisation derived from the verified bearer, never tool args",async()=>{
  await handlers.get("lookout_list_projects")!({});
  await handlers.get("lookout_list_attention")!({});
  await handlers.get("lookout_list_agent_reports")!({});
  expect(listTenantPortfolioProjects).toHaveBeenCalledWith(4);
  expect(listOrganisationMcpFindings).toHaveBeenCalledWith(4);
  expect(listWorkspaceReports).toHaveBeenCalledWith(4,50);
 });
 it("returns not found when a guessed project is not in this organisation",async()=>{
  const forbidden=await handlers.get("lookout_get_portfolio_project")!({portfolioId:55});
  expect(forbidden).toMatchObject({isError:true});
  expect(authorisedPortfolioProject).toHaveBeenCalledWith(4,55);
 });
 it("does not leak internal IDs in whoami",async()=>{
  const result=await handlers.get("lookout_whoami")!({});
  const serialized=JSON.stringify(result);
  expect(serialized).toContain("readOnly");
  expect(serialized).not.toContain("connectionId");
  expect(serialized).not.toContain("userId");
 });
});
