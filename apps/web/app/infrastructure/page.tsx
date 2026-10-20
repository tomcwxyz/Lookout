import Link from "next/link";
import { databaseConfigured, getInfrastructurePortfolio } from "@lookout/db";
import { LinkForm } from "./resource-link-form";
import { ScanControls } from "../components/scan-controls";

export const dynamic = "force-dynamic";

export default async function InfrastructurePage() {
  const data = databaseConfigured() ? await getInfrastructurePortfolio().catch(() => null) : null;
  const resources = data?.resources ?? [];
  const findings = data?.findings ?? [];
  const children = resources.filter(r => r.kind === "neon_branch" || r.kind === "vercel_deployment");
  const projects = resources.filter(r => r.kind === "neon_project" || r.kind === "vercel_project");
  return <main className="detail-layout">
    <Link href="/" className="back-link">← Portfolio overview</Link>
    <div className="detail-header">
      <div><span className="eyebrow">LOOKOUT / INFRASTRUCTURE</span><h1>Cloud resources</h1>
        <p>Read-only observations from Neon and Vercel. No inferred spending or automatic deletions.</p>
      </div>
    </div>
    {!data && <section className="notice"><strong>No infrastructure data available</strong>
      <p>Apply migration 0002, configure NEON_API_KEY or VERCEL_API_TOKEN, then run npm run sync.</p>
    </section>}
    <ScanControls compact />
    <div className="metrics">
      <div className="metric"><span>Provider projects</span><strong>{projects.length}</strong><small>Neon and Vercel</small></div>
      <div className="metric"><span>Branches / deployments</span><strong>{children.length}</strong><small>Latest deployment per environment</small></div>
      <div className="metric"><span>Attention items</span><strong className="accent-amber">{findings.length}</strong><small>Evidence-backed checks</small></div>
      <div className="metric"><span>Unlinked resources</span><strong>{resources.filter(r => !r.projectId).length}</strong><small>Including explicitly excluded</small></div>
    </div>
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-heading"><div><span className="eyebrow">PROVIDER HEALTH</span><h2>Last observation</h2></div></div>
      <div className="detail-row"><strong>Neon</strong><span>{data?.syncs[0] ? data.syncs[0].status + " · " + data.syncs[0].count + " resources" : "Not configured / not run"}</span></div>
      <div className="detail-row"><strong>Vercel</strong><span>{data?.syncs[1] ? data.syncs[1].status + " · " + data.syncs[1].count + " resources" : "Not configured / not run"}</span></div>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">RESOURCE INVENTORY</span><h2>Observed infrastructure</h2></div><span className="count-pill">{resources.length}</span></div>
      {resources.length === 0 ? <div className="empty"><span className="empty-icon">⌁</span><h3>No resources observed</h3><p>Connect one of the providers with read-only API access to start inventorying infrastructure.</p></div> :
        resources.map(resource => {
          const matched = findings.filter(f => f.resourceId === resource.id);
          return <article className="resource-entry" key={resource.key}>
            <div className="resource-info">
              <span className="overline">{resource.provider} / {resource.kind.replace("_", " ")} {resource.linkMethod ? " · " + resource.linkMethod.replace("_", " ") : ""}</span>
              <h3><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name} ↗</a></h3>
              <p>{resource.snapshot.status ?? "Status not supplied"} · {resource.snapshot.endpointCount ?? "—"} compute endpoints · observed {new Date(resource.observedAt).toLocaleString("en-GB")}</p>
              {matched.map(item => <p className="infra-warning" key={item.id}>⚠ {item.explanation}</p>)}
            </div>
            <LinkForm resourceKey={resource.key} projectId={resource.projectId} projects={data?.projects ?? []} />
          </article>;
        })}
    </section>
    <footer className="footer"><span>LOOKOUT / INFRASTRUCTURE ALPHA</span><span>Explicit links override automatic matches.</span></footer>
  </main>;
}
