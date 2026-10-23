import Link from "next/link";
import { databaseConfigured, getLogicalPortfolio, listPortfolioContributions } from "@lookout/db";
export const dynamic="force-dynamic";
export default async function AgentsPage(){
 const portfolio=databaseConfigured()?await getLogicalPortfolio().catch(()=>null):null;
 const projects=portfolio?.projects??[];
 const entries=(await Promise.all(projects.map(async p=>({project:p,items:await listPortfolioContributions(p.id,12).catch(()=>[])})))).flatMap(x=>x.items.map(item=>({...item,project:x.project}))).sort((a,b)=>new Date(b.recordedAt).getTime()-new Date(a.recordedAt).getTime()).slice(0,50);
 const agents=new Set(entries.map(e=>e.agent)).size;
 return <main className="detail-layout"><Link className="back-link" href="/">← Overview</Link>
 <div className="detail-header"><div><span className="eyebrow">AGENTS / PROJECT INTELLIGENCE</span><h1>Agent activity</h1><p>Contributions from coding assistants, kept separate from independently observed evidence and human decisions.</p></div></div>
 <div className="metrics"><div className="metric"><span>Recent reports</span><strong>{entries.length}</strong><small>Across your logical portfolio</small></div><div className="metric"><span>Reporting agents</span><strong>{agents}</strong><small>Distinct reported agent names</small></div><div className="metric"><span>Projects reporting</span><strong>{new Set(entries.map(e=>e.project.id)).size}</strong><small>Project-scoped contributors</small></div><div className="metric"><span>Trust level</span><strong style={{fontSize:22}}>Unverified</strong><small>Agent claims are never automatic acceptance</small></div></div>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST REPORTS</span><h2>Shared agent memory</h2></div><span className="count-pill">{entries.length} most recent</span></div>
 {!entries.length?<div className="empty"><h3>No agent contributions yet</h3><p>Connect an assistant from a repository page and submit a scoped contribution. Once reported, it appears here with attribution.</p></div>:entries.map(item=><article key={item.id} className="attention-row"><span className="signal"/><div className="attention-body"><span className="overline">{item.kind.replaceAll("_"," ")} · Agent-reported · {item.agent} · {new Date(item.recordedAt).toLocaleString("en-GB")}</span><h3>{item.title}</h3><p>{item.payload.summary}</p><p>Project: <Link href={"/portfolio/"+item.project.id}>{item.project.name} →</Link> · {item.repository}</p><p><strong>Suggested next:</strong> {item.nextStep}</p></div></article>)}
 </section></main>;
}
