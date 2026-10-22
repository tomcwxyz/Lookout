import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Connections() {
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
