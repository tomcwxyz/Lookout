import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getTenantLookoutOverview,listVerifiedIdentityOrganisations} from "@lookout/db";
import {getLabIdentity} from "../../../lib/auth/lab-server";
import {verifiedWorkspace} from "../../../lib/verified-workspace";

export const dynamic="force-dynamic";
function when(value:string|null){if(!value)return "Not observed";const d=new Date(value);return Number.isNaN(d.valueOf())?"Not observed":new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(d);}
export default async function LabWorkspace({params}:{params:Promise<{organisationId:string}>}){
 const {organisationId:raw}=await params;
 if(!/^[1-9][0-9]{0,12}$/.test(raw))notFound();
 const organisationId=Number(raw);
 const identity=await getLabIdentity();if(!identity)redirect("/auth/sign-in");
 const membership=await verifiedWorkspace(async()=>identity,organisationId);
 if(!membership)notFound();
 const organisations=await listVerifiedIdentityOrganisations(identity.issuer,identity.subject);
 const organisation=organisations.find(o=>o.id===organisationId);if(!organisation)notFound();
 const view=await getTenantLookoutOverview(organisationId);
 const path="/lab/"+organisationId;
 const projects=view.projects;
 const linked=projects.filter(p=>p.repositoryCount>0).length;
 const inspected=projects.filter(p=>p.inspectedCount>0).length;
 const recent=[...projects].filter(p=>p.latestRepositoryActivity).sort((a,b)=>new Date(b.latestRepositoryActivity!).valueOf()-new Date(a.latestRepositoryActivity!).valueOf()).slice(0,7);
 return <div className="app">
  <aside className="sidebar">
   <Link href={path} className="brand"><span className="brand-icon">◉</span><span>lookout<span className="brand-dot">.</span></span></Link>
   <div className="side-label">{organisation.name.toUpperCase()}</div>
   <nav className="nav" aria-label="Workspace navigation">
    <Link href={path} className="nav-link active"><span>▦</span> Overview</Link>
    <a href="#portfolio" className="nav-link"><span>⌁</span> Projects <span className="nav-count">{projects.length}</span></a>
    <a href="#activity" className="nav-link"><span>✦</span> Agent activity</a>
    <Link href="/lab" className="nav-link"><span>◈</span> Switch workspace</Link>
   </nav>
   <div className="sidebar-bottom"><span className="pulse-dot"/> Organisation workspace · <span className="muted">{membership.role}</span></div>
  </aside>
  <main className="content">
   <div className="topline"><span>WORKSPACE / {organisation.name.toUpperCase()}</span><span>{projects.length} assigned projects · Private to your organisation</span></div>
   <header className="hero dashboard-hero">
    <div><span className="eyebrow">YOUR DEVELOPMENT PORTFOLIO</span><h1>Know what needs <em>attention.</em></h1>
     <p>Your projects, repositories and agent handovers, drawn only from the sources assigned to this organisation.</p></div>
    <div className="hero-mark" aria-hidden="true"><div className="radar-ring ring-1"/><div className="radar-ring ring-2"/><div className="radar-ring ring-3"/><div className="radar-centre"/></div>
   </header>
   <div className="metrics">
    <div className="metric"><span>Projects</span><strong>{projects.length}</strong><small>Assigned to this organisation</small></div>
    <div className="metric"><span>With repositories</span><strong>{linked}</strong><small>Linked to observed GitHub sources</small></div>
    <div className="metric"><span>Inspected</span><strong>{inspected}</strong><small>Projects with detailed observations</small></div>
    <div className="metric"><span>Agent reports</span><strong>{view.recentActivity.length}</strong><small>Most recent 12 recorded reports</small></div>
   </div>
   <div className="dashboard-grid">
    <section className="panel" id="activity"><div className="panel-heading"><div><span className="eyebrow">PROJECT INTELLIGENCE</span><h2>Latest agent handovers</h2></div><span className="count-pill">Unverified reports</span></div>
     {!view.recentActivity.length?<div className="empty"><h3>No agent reports yet</h3><p>When your connected agents contribute, their handovers appear here. Claims are not automatically treated as completed work.</p></div>:
      view.recentActivity.map(e=><article className="attention-row" key={e.id}><span className="signal"/><div className="attention-body"><span className="overline">{e.agent} · {when(e.recordedAt)} · Unverified</span><h3>{e.title}</h3><p>{e.summary||"No summary supplied."}</p><Link href={path+"/projects/"+e.projectId}>{e.projectName} →</Link></div></article>)}
    </section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SOURCE ACTIVITY</span><h2>Recently active projects</h2></div><span className="count-pill">Observed</span></div>
     {!recent.length?<div className="empty"><h3>No recent source observations</h3><p>Projects can still be opened in the portfolio below.</p></div>:recent.map(p=><div className="project-row" key={p.id}><div className="project-avatar">{p.name.slice(0,2).toUpperCase()}</div><div className="project-body"><Link href={path+"/projects/"+p.id}><strong>{p.name}</strong></Link><span>{p.repositoryCount} linked repositories</span></div><div className="project-side"><small>{when(p.latestRepositoryActivity)}</small></div></div>)}
    </section>
   </div>
   <section id="portfolio" className="work-portfolio" style={{marginTop:25}}>
    <div className="work-heading"><div><span className="eyebrow">WORKSPACE / PROJECT PORTFOLIO</span><h2>All your projects</h2></div><span className="count-pill">{projects.length} projects</span></div>
    <p className="work-caution">Projects are shown only when explicitly shared with this organisation. Statuses without human confirmation remain unconfirmed.</p>
    <div className="work-queue">{projects.map(p=><div className="work-queue-row" key={p.id}><div>
      <Link href={path+"/projects/"+p.id} className="work-project-name">{p.name}</Link>
      <span className="work-status-label">{p.status?.replaceAll("_"," ")??"Unconfirmed"}</span>
      <p>{p.description??p.statusNote??"No project description yet."}</p>
     </div><Link href={path+"/projects/"+p.id} className="back-link">Explore →</Link></div>)}</div>
   </section>
   <footer className="footer"><span>LOOKOUT · ORGANISATION WORKSPACE</span><span>Source observations and unverified agent reports</span></footer>
  </main>
 </div>;
}
