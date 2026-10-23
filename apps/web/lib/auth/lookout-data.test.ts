import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@lookout/db",()=>({
 getPortfolio:vi.fn(),getLogicalPortfolio:vi.fn(),
 getInfrastructurePortfolio:vi.fn(),listTenantPortfolioProjects:vi.fn()
}));
import {
 getPortfolio,getLogicalPortfolio,getInfrastructurePortfolio,listTenantPortfolioProjects
} from "@lookout/db";
import {
 getAccountLogicalPortfolio,getAccountObservedPortfolio,getAccountInfrastructure
} from "./lookout-data";
const first={id:1,name:"Assigned",repositories:[{providerId:"repo1",repositoryObservationId:11,
  detailedAt:new Date("2026-01-01"),visibility:"private",inspectionError:null}],infrastructure:[{key:"neon:one"}]};
const second={id:2,name:"Other account",repositories:[{providerId:"repo2",repositoryObservationId:22,
  detailedAt:null,visibility:"private",inspectionError:null}],infrastructure:[{key:"neon:two"}]};
describe("original Lookout scoped data adapters",()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(listTenantPortfolioProjects).mockResolvedValue([{id:1,name:"Assigned",status:null}]);
  vi.mocked(getLogicalPortfolio).mockResolvedValue({projects:[first,second],coverage:{
   accessibleRepositories:2,inventoriedRepositories:2,detailedRepositories:1,privateRepositories:2,
   inspectionFailures:0,lastInventoryAt:new Date(),nextOffset:10,note:"Global token"
  }} as never);
  vi.mocked(getPortfolio).mockResolvedValue({
   projects:[{id:11,name:"Assigned"},{id:22,name:"Other"}],
   attention:[{id:8,projectId:11},{id:9,projectId:22}],
   workDecisions:[{projectId:11},{projectId:22}],
   latestRun:{id:50}
  } as never);
  vi.mocked(getInfrastructurePortfolio).mockResolvedValue({
   resources:[{id:51,key:"neon:one",projectId:11},{id:52,key:"neon:two",projectId:22}],
   findings:[{resourceId:51},{resourceId:52}],
   projects:[{id:11},{id:22}],syncs:[{provider:"neon"},{provider:"vercel"}]
  } as never);
 });
 it("filters the full portfolio page to explicitly assigned projects",async()=>{
  const data=await getAccountLogicalPortfolio(7);
  expect(data.projects.map(p=>p.name)).toEqual(["Assigned"]);
  expect(data.coverage.privateRepositories).toBe(1);
  expect(data.coverage.inventoriedRepositories).toBe(1);
  expect(data.coverage.lastInventoryAt).toBeNull();
 });
 it("filters the unchanged original dashboard's findings, decisions and observed projects",async()=>{
  const data=await getAccountObservedPortfolio(7);
  expect(data.projects.map(p=>p.id)).toEqual([11]);
  expect(data.attention.map(p=>p.projectId)).toEqual([11]);
  expect(data.workDecisions.map(p=>p.projectId)).toEqual([11]);
  expect(data.latestRun).toBeNull();
 });
 it("never shows a different organisation's Neon resources or cloud findings",async()=>{
  const data=await getAccountInfrastructure(7);
  expect(data.resources.map(p=>p.key)).toEqual(["neon:one"]);
  expect(data.findings.map(p=>p.resourceId)).toEqual([51]);
  expect(data.projects.map(p=>p.id)).toEqual([11]);
  expect(data.syncs).toEqual([null,null]);
 });
 it("returns an empty original dashboard when no projects are granted",async()=>{
  vi.mocked(listTenantPortfolioProjects).mockResolvedValue([]);
  expect((await getAccountLogicalPortfolio(7)).projects).toEqual([]);
  expect((await getAccountObservedPortfolio(7)).attention).toEqual([]);
  expect((await getAccountInfrastructure(7)).resources).toEqual([]);
 });
});
