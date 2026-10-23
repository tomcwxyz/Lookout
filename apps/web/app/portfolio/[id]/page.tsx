import Link from "next/link";
import { notFound } from "next/navigation";
import { databaseConfigured, getLogicalPortfolio, getUnassignedInfrastructure, listPortfolioContributions, listChatgptContributions } from "@lookout/db";
import { PortfolioContributions } from "../../components/portfolio-contributions";
import { AssignRepository, AssignInfrastructure, ConfirmProjectStatus, statusLabels } from "../portfolio-actions";
export const dynamic = "force-dynamic";

export default async function PortfolioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!databaseConfigured() || !Number.isSafeInteger(id) || id < 1) notFound();
  const data = await getLogicalPortfolio();
  const project = data.projects.find(p => p.id === id);
  if (!project) notFound();
  const linked = new Set(project.repositories.map(r => r.providerId));
  const [infrastructureCandidates, contributions] = await Promise.all([
    getUnassignedInfrastructure(), listPortfolioContributions(id, 40).catch(() => [])
  ]);
  const chatgptContributions = Array.from(await listChatgptContributions(id).catch(() => []), row => ({ id: row.id, kind: row.kind, payload: row.payload, recorded_at: row.recorded_at }));
  const candidates = data.projects.flatMap(p => p.repositories
    .filter(r => !linked.has(r.providerId))
    .map(r => ({ providerId: r.providerId, slug: r.slug, currentProject: p.name })));
  return <main className="detail-layout">
    <Link href="/portfolio" className="back-link">← All projects</Link>
    <div className="detail-header"><div><span className="eyebrow">PORTFOLIO / CONFIRMED STATUS</span>
      <h1>{project.name}</h1><p>{project.description || "No project description yet."}</p></div>
      <span className={project.status ? "mini-clear" : "mini-alert"}>
        {project.status ? statusLabels[project.status] ?? project.status : "Unconfirmed"}</span></div>
    <section className="panel portfolio-edit">
      <div className="panel-heading"><h2>Project status</h2></div>
      <ConfirmProjectStatus id={id} initialStatus={project.status} initialNote={project.statusNote} />
      {project.statusConfirmedAt && <p className="muted padded">Last confirmed {new Date(project.statusConfirmedAt).toLocaleString("en-GB")}</p>}
    </section>
    <section className="panel portfolio-edit">
      <div className="panel-heading"><h2>Linked GitHub repositories ({project.repositories.length})</h2></div>
      {project.repositories.map(r => <div className="detail-row" key={r.providerId}>
        <div><strong><a href={r.url} target="_blank" rel="noopener noreferrer">{r.slug} ↗</a></strong>
          <small>{r.visibility} · {r.detailedAt ? "last detailed " + new Date(r.detailedAt).toLocaleString("en-GB") : "awaiting detailed scan"}
            {r.inspectionError ? " · inspection error" : ""}</small></div>
        {r.repositoryObservationId && <Link className="back-link" href={"/projects/" + r.repositoryObservationId}>Work &amp; CI →</Link>}
      </div>)}
      <AssignRepository portfolioId={id} repositories={candidates} />
    </section>
    <section className="panel portfolio-edit">
      <div className="panel-heading"><h2>Linked infrastructure ({project.infrastructure.length})</h2></div>
      {project.infrastructure.map(r => <div className="detail-row" key={r.key}>
        <div><strong><a href={r.url} target="_blank" rel="noopener noreferrer">{r.name} ↗</a></strong>
          <small>{r.provider} · {r.kind.replaceAll("_", " ")} · {r.linkMethod.replaceAll("_", " ")}</small></div>
      </div>)}
      <AssignInfrastructure portfolioId={id} resources={infrastructureCandidates} />
    </section>
    <PortfolioContributions chatgptContributions={chatgptContributions} contributions={contributions}
      setupLinks={project.repositories.filter(r => r.repositoryObservationId !== null)
        .map(r => ({ id: r.repositoryObservationId!, slug: r.slug }))} />
    <section className="notice"><strong>What this status means</strong>
      <p>Human-confirmed lifecycle state is never inferred from pushes, open PRs, passing CI or deployment status.
      Repository observations are linked evidence, not proof of product health or acceptance.</p>
    </section>
  </main>;
}
