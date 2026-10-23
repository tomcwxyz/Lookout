import Link from "next/link";
import {redirect} from "next/navigation";
import {listVerifiedIdentityOrganisations} from "@lookout/db";
import {getLabIdentity} from "../../lib/auth/lab-server";
import {createLabOrganisation,signOutLab} from "./actions";
export const dynamic="force-dynamic";
export default async function LabHome(){
 const identity=await getLabIdentity();
 if(!identity)redirect("/auth/sign-in");
 const workspaces=await listVerifiedIdentityOrganisations(identity.issuer,identity.subject);
 if (workspaces.length===1) redirect("/workspace/"+workspaces[0].id+"/activate");
 return <main className="detail-layout" style={{maxWidth:850,margin:"3rem auto"}}>
  <div className="detail-header"><div><span className="eyebrow">LOOKOUT / YOUR WORKSPACES</span>
  <h1>Welcome{identity.name?", "+identity.name:""}</h1>
  <p>Choose an organisation to see only its projects and shared agent activity.</p></div>
  <form action={signOutLab}><button type="submit">Sign out</button></form></div>
  <section className="panel" style={{padding:24}}><h2>Your organisations</h2>
   {workspaces.length? <ul>{workspaces.map(o=><li key={o.id} style={{padding:10}}>
    <Link href={"/workspace/"+o.id+"/activate}><strong>{o.name}</strong></Link> · {o.role}
   </li>)}</ul>:<p>No organisations yet. Create your first private workspace below.</p>}
  </section>
  {workspaces.length===0&&<section className="panel" style={{padding:24}}>
   <h2>Create your workspace</h2>
   <form action={createLabOrganisation} style={{display:"grid",gap:12,maxWidth:460}}>
    <label>Organisation name <input name="name" required minLength={2} maxLength={100} placeholder="My team" /></label>
    <label>Workspace address <input name="slug" required pattern="[a-z0-9][a-z0-9-]{2,49}" placeholder="my-team" /></label>
    <button type="submit">Create private workspace</button>
   </form>
  </section>}
 </main>;
}
