import Link from "next/link";
import { databaseConfigured, getLogicalPortfolio } from "@lookout/db";
import { CreateProject, statusLabels } from "./portfolio-actions";
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const data = databaseConfigured() ? await getLogicalPortfolio().catch(() => null) : null;
  const projects = data?.projects ?? [];
  const coverage = data?.coverage;
  return <main className="detail-layout">
    <Link href="/" className="back-link">← Portfolio overview</Link>
    <div className="detail-header"><div><span className="eyebrow">LOOKOUT / PROJECTS</span>
      <h1>Your project portfolio</h1>
      <p>Products and initiatives, not just repositories. Status is confirmed by you; GitHub activity is observed evidence.</p>
    </div></div>
    {!data && <section className="notice"><strong>Portfolio schema not yet available</strong>
      <p>Apply the additive Lookout migration 0007 and run GitHub discovery. Existing observations are retained.</p>
    </section>}
    <div className="metrics">
      <div className="metric"><span>Logical projects</span><strong>{projects.length}</strong><small>Can span multiple repositories</small></div>
      <div className="metric"><span>Repositories inventoried</span><strong>{coverage?.inventoriedRepositories ?? 0}</strong><small>{coverage?.privateRepositories ?? 0} private, accessible to Lookout</small></div>
      <div className="metric"><span>Detailed observations</span><strong>{coverage?.detailedRepositories ?? 0}</strong><small>Inspected in rotating batches</small></div>
      <div className="metric"><span>Confirmed statuses</span><strong>{projects.filter(p => p.status).length}</strong><small>Others deliberately unknown</small></div>
    </div>
    {coverage && <section className="notice"><strong>Discovery coverage</strong>
      <p>{coverage.accessibleRepositories} repositories returned by Lookout's GitHub token · {coverage.inspectionFailures} inspection failures ·
      last inventory {coverage.lastInventoryAt ? new Date(coverage.lastInventoryAt).toLocaleString("en-GB") : "not yet run"}.
      A repository outside this inventory may be inaccessible to the token, not absent from GitHub.</p>
    </section>}
    <section className="panel portfolio-create"><div className="panel-heading"><h2>New initiative</h2></div><CreateProject /></section>
    <section className="panel portfolio-directory">
      <div className="panel-heading"><div><span className="eyebrow">PRODUCTS / INITIATIVES</span><h2>All projects</h2></div>
        <span className="count-pill">{projects.length}</span></div>
      {projects.map(p => <Link key={p.id} className="project-row" href={"/portfolio/" + p.id}>
        <div className="project-avatar">{p.name.slice(0,2).toUpperCase()}</div>
        <div className="project-body"><strong>{p.name}</strong>
          <small>{p.repositories.length ? p.repositories.map(r => r.slug).join(" · ") : "No repository linked"}</small>
          <span>{p.statusNote || p.description || "No confirmed status or description yet"}</span></div>
        <div className="project-side"><span className={p.status ? "mini-clear" : "mini-alert"}>
          {p.status ? statusLabels[p.status] ?? p.status : "Unconfirmed"}</span>
          <small>{p.repositories.filter(r => r.detailedAt).length}/{p.repositories.length} inspected</small></div>
      </Link>)}
      {projects.length === 0 && <p className="muted padded">Run a GitHub scan to discover repositories, or create a project above.</p>}
    </section>
    <footer className="footer"><span>LOOKOUT / PORTFOLIO</span><span>Confirmed status and observed evidence stay separate.</span></footer>
  </main>;
}
