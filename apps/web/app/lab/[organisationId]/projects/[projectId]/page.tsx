import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getTenantLookoutProject} from "@lookout/db";
import {getLabIdentity} from "../../../../lib/auth/lab-server";
import {verifiedWorkspace} from "../../../../lib/verified-workspace";
export const dynamic="force-dynamic";
export default async function TenantProject({params}:{params:Promise<{organisationId:string;projectId:string}>}){
 const {organisationId:org,projectId:project}=await params;
 if(!/^[1-9][0-9]{0,12}$/.test(org)||!/^[1-9][0-9]{0,12}$/.test(project))notFound();
 const identity=await getLabIdentity();if(!identity)redirect("/auth/sign-in");
 const organisationId=Number(org),projectId=Number(project);
 if(!await verifiedWorkspace(async()=>identity,organisationId))notFound();
 const data=await getTenantLookoutProject(organisationId,projectId);
 if(!data)notFound();
 const root="/lab/"+organisationId;
 return <div className="app"><aside className="sidebar">
  <Link href={root} className="brand"><span className="brand-icon">◉</span><span>lookout<span className="brand-dot">.</span></span></Link>
  <div className="side-label">ORGANISATION WORKSPACE</div>
  <nav className="nav"><Link href={root} className="nav-link"><span>▦</span> Overview</Link>
   <Link href={root+"#portfolio"} className="nav-link active"><span>⌁</span> Projects</Link>
   <Link href={root+"#activity"} className="nav-link"><span>✦</span> Agent activity</Link></nav>
  </aside><main className="content">
   <div className="topline"><span>PROJECT / {data.name.toUpperCase()}</span><span>Private organisation project</span></div>
   <Link href={root+"#portfolio"} className="back-link">← All projects</Link>
   <div className="detail-header"><div><span className="eyebrow">PROJECT / OBSERVED INTELLIGENCE</span><h1>{data.name}</h1>
    <p>{data.description??"Project description not yet supplied."}</p></div></div>
   <section className="project-summary"><span className="eyebrow">PROJECT STATUS</span>
    <p>{data.status?.replaceAll("_"," ")??"Not yet confirmed"}{data.statusNote?" · "+data.statusNote:""}</p></section>
   <section className="panel" style={{marginTop:24}}><div className="panel-heading"><div><span className="eyebrow">LINKED SOURCES</span><h2>Repositories</h2></div><span className="count-pill">{data.repositories.length}</span></div>
   {data.repositories.length?data.repositories.map(r=><a className="detail-row" key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
    <div><strong>{r.name}</strong><small>{r.visibility} · {r.inspectedAt?"Inspected "+new Date(r.inspectedAt).toLocaleDateString("en-GB"):"Awaiting inspection"}</small></div><span>↗</span></a>):
    <p className="muted padded">No repositories linked yet. This project still belongs to your organisation.</p>}
   </section><footer className="footer"><span>LOOKOUT · ORGANISATION PROJECT</span><span>Read-only evidence · More project intelligence to follow</span></footer>
  </main></div>;
}
