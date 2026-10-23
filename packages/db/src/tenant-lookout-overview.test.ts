import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("./client",()=>({getDatabase:vi.fn()}));
import {getDatabase} from "./client";
import {getTenantLookoutOverview,getTenantLookoutProject} from "./tenant-lookout-overview";
describe("organisation-scoped Lookout intelligence",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("returns no data for invalid organisation IDs without querying",async()=>{
  expect(await getTenantLookoutOverview(-1)).toEqual({projects:[],recentActivity:[]});
  expect(await getTenantLookoutProject(1,-5)).toBeNull();
  expect(getDatabase).not.toHaveBeenCalled();
 });
 it("never uses the global portfolio without explicit tenant scoping",async()=>{
  const execute=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  vi.mocked(getDatabase).mockReturnValue({execute} as never);
  expect(await getTenantLookoutOverview(100)).toEqual({projects:[],recentActivity:[]});
  expect(execute).toHaveBeenCalledTimes(2);
  for(const [statement] of execute.mock.calls){
   const raw=statement as {queryChunks?:Array<{value?:string[]}>};
   const tokens=raw.queryChunks??[];
   const sqlText=tokens.map(x=>Array.isArray(x.value)?x.value.join(""):"").join("");
   expect(sqlText).toContain("lookout_project_access");
   expect(sqlText).toContain("organisation_id");
  }
 });
});
