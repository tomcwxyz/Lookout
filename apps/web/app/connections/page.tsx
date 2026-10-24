import Link from "next/link";
import {McpKeyCreator} from "./mcp-key-creator";
import {revokeReadOnlyConnection} from "./actions";
import { getLookoutContext } from "../../lib/auth/lookout-context";
import { getWorkspaceSourceSummary, listWorkspaceReports, getOrganisationConnectionOverview } from "@lookout/db";

export const dynamic="force-dynamic";
const displayDate=(input:string|null)=>input?new Date(input).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"No successful sync recorded";

export default async function Connections() {
 const account=await getLookoutContext();
 if(account.mode==="account"){
  const [sources,connectors,reports]=await Promise.all([
    getWorkspaceSourceSummary(account.organisationId).catch(()=>null),
    getOrganisationConnectionOverview(account.organisationId).catch(()=>null),
    listWorkspaceReports(account.organisationId,5).catch(()=>[])
  ]);
  return <main className="detail-layout lookout-connections">
   <Link className="back-link" href="/">← Lookout overview</Link>
   <header className="detail-header">
    <div><span className="eyebrow">LOOKOUT / {account.name.toUpperCase()}</span>
      <h1>Connections and observations</h1>
      <p>Understand what Lookout has observed, what is connected to this organisation and what still needs setting up.</p>
    </div>
   </header>
   <section className="metrics" aria-label="Connection overview">
    <div className="metric"><span>Tracked repositories</span><strong>{sources?.repositories??"—"}</strong><small>Existing, granted GitHub observations</small></div>
    <div className="metric"><span>Linked cloud resources</span><strong>{sources?.linkedResources??"—"}</strong><small>Recorded Neon and Vercel resources</small></div>
    <div className="metric"><span>MCP connections</span><strong>{connectors?.active??"—"}</strong><small>Active organisation-scoped connections</small></div>
    <div className="metric"><span>Recent agent reports</span><strong>{reports.length}</strong><small>Latest 5 organisation contributions</small></div>
   </section>
   <div className="detail-columns">
    <section className="panel detail-panel">
     <div className="panel-heading"><div><span className="eyebrow">OBSERVATION HISTORY</span><h2>Source coverage</h2></div><span className="count-pill">Read-only evidence</span></div>
     <div className="lookout-connection-body">
      <p>Lookout retains observations from your assigned GitHub repositories and linked cloud resources. These are historical records, not proof that your account has a current provider connection.</p>
      <div className="lookout-connection-source"><div><strong>GitHub</strong><small>{sources?.repositories??"—"} repositories · {sources?.openFindings??"—"} open findings</small></div><span>Last scan: {displayDate(sources?.githubSync??null)}</span></div>
      <div className="lookout-connection-source"><div><strong>Neon</strong><small>Recorded database and branch observations</small></div><span>Last scan: {displayDate(sources?.neonSync??null)}</span></div>
      <div className="lookout-connection-source"><div><strong>Vercel</strong><small>Recorded deployments and service observations</small></div><span>Last scan: {displayDate(sources?.vercelSync??null)}</span></div>
      <Link href="/infrastructure" className="back-link">Explore infrastructure evidence →</Link>
     </div>
    </section>
    <section className="panel detail-panel">
     <div className="panel-heading"><div><span className="eyebrow">ASSISTANTS AND AGENTS</span><h2>Project handovers</h2></div><Link href="/agents" className="count-pill">View all →</Link></div>
     <div className="lookout-connection-body">
      <p>Reports written by ChatGPT or coding agents preserve what was attempted, what remains and what needs attention. Agent reports are not independent verification.</p>
      {reports.length?reports.map(report=><div className="lookout-connection-source" key={report.id}><div>
        <strong>{report.projectName}</strong><small>{report.title}</small>
        <small>{report.blockerCount} reported blockers · {report.remainingCount} remaining items</small></div>
        <Link href={"/portfolio/"+report.portfolioId} className="back-link">Review →</Link>
      </div>):<div className="lookout-connection-empty"><strong>No recent agent handovers</strong><p>There are no recent reports assigned to this organisation. That does not mean the projects have no unfinished work.</p></div>}
      <Link href="/agents" className="back-link">Explore agent activity →</Link>
     </div>
    </section>
   </div>
   <section className="panel detail-panel lookout-connection-manage">
    <div className="panel-heading"><div><span className="eyebrow">ORGANISATION ACCESS</span><h2>MCP connections</h2></div><span className="count-pill">{connectors?.active??0} active</span></div>
    <div className="lookout-connection-body">
     <p>Organisation owners and admins can issue short-lived, read-only MCP credentials for compatible clients. Each key is restricted to this organisation's explicitly assigned projects and can be revoked at any time.</p>
     {(["owner","admin"].includes(account.role))&&<McpKeyCreator/>}
     <div className="lookout-connection-list" style={{marginTop:22}}>
     {connectors?.connections.length?connectors.connections.map(c=><div className="lookout-connection-source" key={c.id}>
       <div><strong>{c.name}</strong>
        <small>{c.active?"Active · read-only":"Revoked or expired"} · Expires {c.expiresAt?displayDate(c.expiresAt):"unknown"}</small>
       </div>
       {c.active&&["owner","admin"].includes(account.role)?<form action={revokeReadOnlyConnection}>
         <input type="hidden" name="connectionId" value={c.id}/>
         <button className="lookout-revoke-button" type="submit" aria-label={"Revoke "+c.name}>Revoke</button>
       </form>:<span>{c.active?"Active":"Inactive"}</span>}
     </div>):<div className="lookout-connection-empty"><strong>No read-only MCP keys created</strong>
      <p>The existing personal Lookout MCP and coding-agent credentials remain separate. Create an organisation key only for a client you trust.</p></div>}
     </div>
     <p className="work-caution">These keys support Bearer-compatible MCP clients. Organisation-aware ChatGPT OAuth, coding-agent write access and provider scanning are not yet enabled. Creating a read key does not grant any of those permissions.</p>
    </div>
   </section>
   <footer className="footer"><span>LOOKOUT / {account.name.toUpperCase()}</span><span>Observation ≠ connection · Report ≠ confirmation</span></footer>
  </main>;
 }
  // This is server-side only: never render the credential itself.
  const configured = (process.env.LOOKOUT_MCP_OWNER_TOKEN?.length ?? 0) >= 48;
  return (
    <main className="detail-layout">
      <Link href="/" className="back-link">← Portfolio overview</Link>
      <div className="detail-header"><div>
        <span className="eyebrow">PRIVATE CONNECTIONS / ALPHA</span>
        <h1>Connect a web chat</h1>
        <p>Read-only project context for browser-based AI assistants and remote MCP clients.</p>
      </div></div>
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>ChatGPT — OAuth connection</h2></div>
        <div className="padded"><p>In ChatGPT Plugins, add a custom MCP server named Lookout. Choose <strong>Server URL</strong>, enter <code>https://lookout-eosin.vercel.app/api/mcp</code>, and select <strong>OAuth</strong>.</p><p>On first use, sign in to Lookout with your dashboard credentials and explicitly allow read-only access. ChatGPT never needs your personal Bearer token.</p>
        <form method="post" action="/api/oauth/revoke">
          <button type="submit">Disconnect all ChatGPT OAuth sessions</button>
        </form>
        <p className="work-caution">This immediately invalidates OAuth access and refresh tokens. You can authorise again later.</p></div>
      </section>
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>Hosted MCP connection</h2>
          <span className="count-pill">{configured ? "Personal credential configured" : "Personal credential not configured"}</span>
        </div>
        <div className="padded">
          <p>HTTPS endpoint (no local installation required):</p>
          <code>https://lookout-eosin.vercel.app/api/mcp</code>
          <p className="work-caution">A personal credential grants read-only access to your entire observed portfolio. Project tokens only grant access to their own project. The dashboard password is not an MCP credential.</p>
        </div>
      </section>
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>Set up your personal connection</h2></div>
        <div className="padded">
          <p>The following is for MCP Inspector and clients that accept custom Bearer headers; ChatGPT uses the OAuth connection above.</p>
          <ol>
            <li>In Git Bash, generate a private credential: <code>openssl rand -hex 32</code></li>
            <li>Add it to the Lookout Vercel project as <code>LOOKOUT_MCP_OWNER_TOKEN</code>, for Production only.</li>
            <li>Redeploy production, then use MCP Inspector or a compatible remote MCP client with a private Bearer credential.</li>
            <li>Call <code>lookout_whoami</code>, followed by <code>lookout_list_projects</code> to check access.</li>
          </ol>
          <p className="work-caution">Do not paste the credential into chat messages, URLs, GitHub, logs or screenshots. ChatGPT custom MCP support and fixed-token authentication depend on account/workspace capabilities; an OAuth connection is a separate phase.</p>
          <p><a href="https://github.com/tomcwxyz/Lookout/blob/main/docs/HOSTED_MCP.md" target="_blank" rel="noopener noreferrer" className="back-link">Read the full connection and testing guide ↗</a></p>
        </div>
      </section>
    </main>
  );
}
