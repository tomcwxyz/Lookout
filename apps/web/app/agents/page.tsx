import Link from "next/link";
import { getLookoutContext } from "../../lib/auth/lookout-context";
import { getAccountLogicalPortfolio } from "../../lib/auth/lookout-data";
import { databaseConfigured, getLogicalPortfolio, listPortfolioContributions, listChatgptContributions, listWorkspaceReports } from "@lookout/db";
export const dynamic="force-dynamic";
export default async function AgentsPage(){
 const account=await getLookoutContext();
 const portfolio=databaseConfigured()?await (account.mode==="account"?getAccountLogicalPortfolio(account.organisationId):getLogicalPortfolio()).catch(()=>null):null;
 const projects=portfolio?.projects??[];
 const legacyEntries=account.mode==="account"?[]:(await Promise.all(projects.map(async p=>{
 const [agents, chatgpt]=await Promise.all([listPortfolioContributions(p.id,12).catch(()=>[]),listChatgptContributions(p.id).catch(()=>[])]);
 return [...agents.map(item=>({id:"agent-"+item.id,project:p,kind:item.kind,agent:item.agent,title:item.title,summary:item.payload.summary,recordedAt:item.recordedAt,nextStep:item.payload.remaining.find((t:string)=>t.startsWith("Next: "))?.slice(6)??item.nextStep,source:"Coding agent",repository:item.repository})),...chatgpt.map(item=>{const payload=item.payload as {agent?:string;title?:string;summary?:string;remaining?:string[]};return {id:"chatgpt-"+item.id,project:p,kind:String(item.kind),agent:"ChatGPT",title:payload.title??"ChatGPT report",summary:payload.summary??"",recordedAt:new Date(String(item.recorded_at)),nextStep:payload.remaining?.find(t=>t.startsWith("Next: "))?.slice(6)??payload.remaining?.[0]??"Review reported progress",source:"ChatGPT",repository:"Portfolio contribution"};})];
 }))).flat().sort((a,b)=>new Date(b.recordedAt).getTime()-new Date(a.recordedAt).getTime()).slice(0,50);
 const entries=account.mode==="legacy"?legacyEntries:(await listWorkspaceReports(account.organisationId,50).catch(()=>[])).map(item=>({
  id:item.id,project:{id:item.portfolioId,name:item.projectName},kind:item.kind,agent:item.agent,
  title:item.title,summary:item.summary,recordedAt:new Date(item.recordedAt),nextStep:item.nextStep,
  source:item.source==="agent"?"Coding agent":"ChatGPT",repository:"Organisation project"
 }));
 const agents=new Set(entries.map(e=>e.agent)).size;
 return <main className="detail-layout"><Link className="back-link" href="/">← Overview</Link>
 <div className="detail-header"><div><span className="eyebrow">AGENTS / PROJECT INTELLIGENCE</span><h1>Session notes and agent activity</h1><p>Plain-English session handovers from connected agents. Reports remain separate from independently observed evidence and human-confirmed decisions.</p></div></div>
 <div className="metrics"><div className="metric"><span>Recent reports</span><strong>{entries.length}</strong><small>Across your logical portfolio</small></div><div className="metric"><span>Reporting agents</span><strong>{agents}</strong><small>Distinct reported agent names</small></div><div className="metric"><span>Projects reporting</span><strong>{new Set(entries.map(e=>e.project.id)).size}</strong><small>Project-scoped contributors</small></div><div className="metric"><span>Trust level</span><strong style={{fontSize:22}}>Unverified</strong><small>Agent claims are never automatic acceptance</small></div></div>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST REPORTS</span><h2>Where work was left</h2></div><span className="count-pill">{entries.length} most recent</span></div>
 {!entries.length?<div className="empty"><h3>No agent contributions yet</h3><p>Connect an assistant from a repository page and submit a scoped contribution. Once reported, it appears here with attribution.</p></div>:entries.map(item=><article key={item.id} className="attention-row"><span className="signal"/><div className="attention-body"><span className="overline">{item.kind.replaceAll("_"," ")} · {item.source} · Unverified · {item.agent} · {new Date(item.recordedAt).toLocaleString("en-GB")}</span><h3>{item.title}</h3><p>{item.summary}</p><p>Project: <Link href={"/portfolio/"+item.project.id}>{item.project.name} →</Link> · {item.repository}</p><p><strong>Suggested next:</strong> {item.nextStep}</p></div></article>)}
 </section></main>;
}
