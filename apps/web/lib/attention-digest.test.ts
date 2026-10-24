import {describe,it,expect} from "vitest";
import {composeWorkspacePriorities, type ObservedFinding, type ReportSignal} from "./attention-digest";
const now=new Date("2026-10-24T12:00:00Z");
const finding=(id:number,projectId:number,kind:string,severity="warning"):ObservedFinding=>({
 id,projectId,project:projectId===1?"Relay":"Mossline",kind,severity,
 title:kind,explanation:"source observation",url:"https://github.com/example/evidence/"+id,
 at:"2026-10-23T12:00:00Z"
});
const report=(projectId:number,blockerCount:number):ReportSignal=>({
 id:"agent:"+projectId,portfolioId:projectId,projectName:projectId===1?"Relay":"Mossline",
 title:"Agent handover",nextStep:"Review with maintainer",blockerCount,remainingCount:2,
 recordedAt:"2026-10-24T11:00:00Z"
});
describe("evidence-first priorities",()=>{
 it("groups noisy branches per project and ranks failure above housekeeping",()=>{
  const result=composeWorkspacePriorities([
   ...Array.from({length:30},(_,i)=>finding(i+1,1,"stale_branch")),
   finding(42,2,"failed_workflow","critical")
  ],[],now);
  expect(result).toHaveLength(2);
  expect(result[0].projectId).toBe(2);
  expect(result[0].level).toBe("urgent");
  expect(result[1].findingCount).toBe(30);
  expect(result[1].title).toContain("Ageing branches");
 });
 it("never states agent reports are verified or the cause of CI failure",()=>{
  const result=composeWorkspacePriorities([finding(1,1,"failed_workflow","critical")],[report(1,2)],now);
  expect(result).toHaveLength(1);
  expect(result[0].explanation).toContain("not verified");
  expect(result[0].sources.map(s=>s.type)).toEqual(["observation","agent"]);
  expect(result[0].suggestedAction).toContain("Review the failing CI run");
 });
 it("keeps each project's reported blocker separate",()=>{
  const cards=composeWorkspacePriorities([],[report(1,2),report(2,0)],now);
  expect(cards).toHaveLength(2);
  expect(cards.find(c=>c.projectId===1)?.reportedBlockers).toBe(2);
  expect(cards.find(c=>c.projectId===2)?.reportedBlockers).toBe(0);
  expect(cards[0].sources[0].url).toMatch(/^\/portfolio\//);
 });
 it("excludes old agent claims from current priorities without deleting history",()=>{
  const old={...report(1,3),recordedAt:"2026-08-01T00:00:00Z"};
  expect(composeWorkspacePriorities([],[old],now)).toHaveLength(0);
 });
 it("discards unscoped or invalid project IDs rather than inventing projects",()=>{
  expect(composeWorkspacePriorities([{...finding(1,0,"failed_workflow","critical")}],[{...report(-1,5)}],now)).toHaveLength(0);
 });
 it("only links evidence and does not invent a cited source when unavailable",()=>{
  const results=composeWorkspacePriorities([{...finding(1,1,"stale_pr"),url:"/unsafe"}],[],now);
  expect(results[0].sources).toEqual([]);
 });
 it("enforces a short bounded summary",()=>{
  const cards=composeWorkspacePriorities(Array.from({length:20},(_,i)=>finding(i+1,i+1,"stale_pr")),[],now,4);
  expect(cards).toHaveLength(4);
 });
});
