import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getLabIdentity} from "../../../lib/auth/lab-server";
import {verifiedWorkspaceProjects} from "../../../lib/verified-workspace";
export const dynamic="force-dynamic";
export default async function LabWorkspace({params}:{params:Promise<{organisationId:string}>}){
 const {organisationId:raw}=await params;
 if(!/^[1-9][0-9]{0,12}$/.test(raw))notFound();
 const identity=await getLabIdentity();if(!identity)redirect("/auth/sign-in");
 const workspace=await verifiedWorkspaceProjects(async()=>identity,Number(raw));
 if(!workspace)notFound();
 return <main className="detail-layout" style={{maxWidth:900,margin:"3rem auto"}}>
  <Link href="/lab" className="back-link">← Your organisations</Link>
  <header className="detail-header"><div><span className="eyebrow">PRIVATE ORGANISATION WORKSPACE</span>
   <h1>Your projects</h1><p>Role: {workspace.workspace.role}. Only projects explicitly assigned to this organisation appear here.</p></div></header>
  <section className="panel" style={{padding:24}}><h2>Project portfolio</h2>
  {!workspace.projects.length?<p>No projects in this organisation yet. Your existing single-owner portfolio has not been shared with this account.</p>:
  <ul>{workspace.projects.map(project=><li key={project.id}>{project.name}</li>)}</ul>}
  </section>
 </main>;
}
