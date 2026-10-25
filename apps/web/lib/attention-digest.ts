/** Explainable, deterministic attention triage. It never invents events or verifies agent claims.
 * Input data is already constrained to an authenticated organisation.
 */
export type ObservedFinding = {
 id:number;projectId:number;project:string;kind:string;severity:string;
 title:string;explanation:string;url:string;at:string
};
export type ReportSignal = {
 id:string;portfolioId:number;projectName:string;title:string;nextStep:string;
 blockerCount:number;remainingCount:number;recordedAt:string
};
export type AttentionPriority = {
 key:string;projectId:number;projectName:string;title:string;explanation:string;
 suggestedAction:string;level:"review"|"urgent";kinds:string[];
 sources:Array<{url:string;label:string;type:"observation"|"agent"}>;
 findingCount:number;reportedBlockers:number;rank:number
};
const safeDate=(value:string)=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
const withinDays=(value:string,now:number,days:number)=>safeDate(value)>0&&
 safeDate(value)<=now&&now-safeDate(value)<=days*86400000;

export function composeWorkspacePriorities(
 findings:ObservedFinding[], reports:ReportSignal[], now:Date=new Date(), max=8
):AttentionPriority[]{
 const byProject=new Map<number,{name:string;findings:ObservedFinding[];reports:ReportSignal[]}>();
 for(const f of findings){
  if(!Number.isSafeInteger(f.projectId)||f.projectId<=0)continue;
  const p=byProject.get(f.projectId)??{name:f.project,findings:[],reports:[]};
  p.findings.push(f);byProject.set(f.projectId,p);
 }
 for(const r of reports){
  if(!Number.isSafeInteger(r.portfolioId)||r.portfolioId<=0)continue;
  const p=byProject.get(r.portfolioId)??{name:r.projectName,findings:[],reports:[]};
  p.reports.push(r);byProject.set(r.portfolioId,p);
 }
 const nowMs=now.getTime();
 const cards:AttentionPriority[]=[];
 for(const [projectId,project] of byProject){
  const observed=project.findings.filter(f=>f.severity==="critical"||f.kind==="stale_pr"||f.kind==="stale_branch");
  const failures=observed.filter(f=>f.kind==="failed_workflow");
  const critical=observed.filter(f=>f.severity==="critical");
  const prs=observed.filter(f=>f.kind==="stale_pr");
  const branches=observed.filter(f=>f.kind==="stale_branch");
  const recentReports=project.reports.filter(r=>withinDays(r.recordedAt,nowMs,30)&&
   (r.blockerCount>0||r.remainingCount>0));
  const mostRecent=[...recentReports].sort((a,b)=>safeDate(b.recordedAt)-safeDate(a.recordedAt))[0];
  const verifiedSignal=failures.length>0||critical.length>0||prs.length>0;
  if(!observed.length&&!mostRecent)continue;
  const principal=failures[0]??critical[0]??prs[0]??branches[0];
  const hasReportedBlockers=Boolean(mostRecent?.blockerCount);
  const level:"review"|"urgent"=critical.length>0?"urgent":"review";
  const title=failures.length>0?"Failed CI needs investigation"
   :critical.length>0?"Critical source finding needs review"
   :prs.length>0?"Pull requests appear to need a decision"
   :hasReportedBlockers?"Agent reports an unresolved blocker"
   :branches.length>0?"Ageing branches may need tidying"
   :"An agent has unfinished work to review";
  const parts=[
   failures.length>0?`${failures.length} failed workflow ${failures.length===1?"finding":"findings"}`:null,
   critical.length>failures.length?`${critical.length-failures.length} other critical ${critical.length-failures.length===1?"finding":"findings"}`:null,
   prs.length>0?`${prs.length} ageing pull ${prs.length===1?"request":"requests"}`:null,
   branches.length>0?`${branches.length} ageing ${branches.length===1?"branch":"branches"}`:null,
   hasReportedBlockers?`${mostRecent!.blockerCount} agent-reported ${mostRecent!.blockerCount===1?"blocker":"blockers"} (not verified)`:null
  ].filter((x):x is string=>Boolean(x));
  const source=principal?.url&&/^https:\/\//.test(principal.url)?principal.url:null;
  const sources:AttentionPriority["sources"]=[];
  if(source)sources.push({url:source,label:"Inspect observed evidence",type:"observation"});
  if(mostRecent)sources.push({url:"/portfolio/"+projectId,label:"Read unverified handover",type:"agent"});
  const suggestedAction=failures.length>0?"Review the failing CI run and check whether a newer run resolved it."
   :critical.length>0?"Examine the critical finding and verify its current status."
   :prs.length>0?"Review open PRs and decide whether to merge, update or close them."
   :mostRecent?.nextStep?"Review this reported next step against the project evidence."
   :"Check whether these branches are still needed before archiving.";
  const newestObservation=observed.reduce((v,f)=>Math.max(v,safeDate(f.at)),0);
  const recentEvidence=withinDays(new Date(newestObservation).toISOString(),nowMs,14);
  const rank=Math.min(160,(critical.length?95:prs.length?64:branches.length?30:20)+
   Math.min(18,critical.length*5)+Math.min(15,prs.length*2)+
   (hasReportedBlockers?12:0)+(recentEvidence?5:0));
  cards.push({
   key:"priority:"+projectId,projectId,projectName:project.name,title,
   explanation:parts.join(" · ")||"An unverified agent report contains remaining work.",
   suggestedAction,level,kinds:[...new Set(observed.map(f=>f.kind))],
   sources,findingCount:observed.length,reportedBlockers:mostRecent?.blockerCount??0,rank
  });
 }
 return cards.sort((a,b)=>b.rank-a.rank||a.projectName.localeCompare(b.projectName)).slice(0,Math.max(1,Math.min(25,max)));
}
