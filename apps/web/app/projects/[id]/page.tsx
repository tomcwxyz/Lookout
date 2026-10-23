import Link from "next/link";
import { getLookoutContext } from "../../../lib/auth/lookout-context";
import { getAccountLogicalPortfolio } from "../../../lib/auth/lookout-data";
import { notFound } from "next/navigation";
import { databaseConfigured, getProject, getLinkedResources, listAgentCheckpoints, listAgentTokens } from "@lookout/db";
import { IdeaForm } from "./idea-form";
import { deriveWorkHandover } from "@lookout/core";
import { WorkHandoverPanel } from "../../components/work-handover";
import { ProjectActivity } from "../../components/project-activity";
import { AgentConnections } from "../../components/agent-connections";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const number = Number(id);
  if (!databaseConfigured() || !Number.isSafeInteger(number) || number <= 0) notFound();
  const account = await getLookoutContext();
  if (account.mode === "account") {
    const allowed = await getAccountLogicalPortfolio(account.organisationId);
    if (!allowed.projects.some(p => p.repositories.some(r => r.repositoryObservationId === number))) notFound();
  }
  const { project, findings, ideas, decisions } = await getProject(number);
  if (!project) notFound();
  const [linkedResources, checkpoints, tokens] = await Promise.all([
    getLinkedResources(number).catch(() => []), listAgentCheckpoints(number,24), account.mode === "legacy" ? listAgentTokens(number) : Promise.resolve([])
  ]);
  const snapshot = project.snapshot;
  const work = deriveWorkHandover(snapshot);
  return (
    <main className="detail-layout">
      <Link href="/" className="back-link">← Portfolio overview</Link>
      <div className="detail-header"><div><span className="eyebrow">PROJECT / {snapshot.provider.toUpperCase()}</span><h1>{project.name}</h1><p>{project.description || snapshot.slug}</p></div><a className="external-link" href={project.url} target="_blank" rel="noopener noreferrer">Open repository ↗</a></div>
      <WorkHandoverPanel handover={work} decisions={decisions} projectId={project.id} readOnly={account.mode === "account"} />
      <ProjectActivity checkpoints={checkpoints} merges={snapshot.recentMerges ?? []} decisions={decisions} />
      {account.mode === "legacy" && <AgentConnections projectId={project.id} initialTokens={tokens.map(token => ({...token,createdAt:token.createdAt.toISOString(),revokedAt:token.revokedAt?.toISOString() ?? null}))} />}
      <section className="project-summary"><span className="eyebrow">TECHNICAL OBSERVATION</span><p>{project.ruleSummary}</p>{project.aiBrief && <div className="ai-brief"><span className="eyebrow">◈ AGENT BRIEF · AI-GENERATED</span><p>{project.aiBrief}</p></div>}</section>
      <div className="detail-columns">
        <section className="panel detail-panel">
          <div className="panel-heading"><h2>Branches ({snapshot.branches.length})</h2></div>
          {snapshot.branches.map(branch => <a key={branch.name} className="detail-row" href={branch.url} target="_blank" rel="noopener noreferrer"><div><strong>{branch.name}</strong>{branch.isDefault && <span className="inline-label">default</span>}<small>{branch.lastCommitAt ? "Latest commit " + new Date(branch.lastCommitAt).toLocaleDateString("en-GB") : "Commit date unavailable"}</small></div><span>↗</span></a>)}
          {snapshot.branches.length === 0 && <p className="muted padded">No branch data returned.</p>}
        </section>
        <section className="panel detail-panel">
          <div className="panel-heading"><h2>Attention ({findings.length})</h2></div>
          {findings.map(f => <a className="detail-row" key={f.id} href={f.evidenceUrl} target="_blank" rel="noopener noreferrer"><div><strong>{f.title}</strong><small>{f.explanation}</small></div><span>↗</span></a>)}
          {findings.length === 0 && <p className="muted padded">No rule-based findings from the most recent observation.</p>}
        </section>
        <section className="panel detail-panel">
          <div className="panel-heading"><h2>Open PRs ({snapshot.pullRequests.length})</h2></div>
          {snapshot.pullRequests.map(pr => <a key={pr.number} className="detail-row" href={pr.url} target="_blank" rel="noopener noreferrer"><div><strong>#{pr.number} {pr.title}</strong><small>{pr.branch} · last updated {new Date(pr.updatedAt).toLocaleDateString("en-GB")}</small></div><span>↗</span></a>)}
          {snapshot.pullRequests.length === 0 && <p className="muted padded">No open pull requests.</p>}
        </section>
        <section className="panel detail-panel">
          <div className="panel-heading"><h2>Linked infrastructure ({linkedResources.length})</h2><Link href="/infrastructure" className="back-link">Manage links →</Link></div>
          {linkedResources.map(r => <a className="detail-row" href={r.url} target="_blank" rel="noopener noreferrer" key={r.id}>
            <div><strong>{r.name}</strong><small>{r.provider} · {r.kind.replaceAll("_", " ")} · {r.snapshot.status ?? "status unknown"} · {r.linkMethod ?? "unlinked"}</small></div><span>↗</span>
          </a>)}
          {linkedResources.length === 0 && <p className="muted padded">No infrastructure linked to this repository yet.</p>}
        </section>
        <section className="panel detail-panel">
          <div className="panel-heading"><h2>Ideas and notes ({ideas.length})</h2></div>
          {account.mode === "legacy" && <IdeaForm projectId={project.id} />}
          {ideas.map(idea => <div key={idea.id} className="detail-row"><div><strong>{idea.title}</strong>{idea.note && <small>{idea.note}</small>}</div><span className="inline-label">{idea.status}</span></div>)}
          {ideas.length === 0 && <p className="muted padded">Capture an idea without creating a formal GitHub issue.</p>}
        </section>
      </div>
      <footer className="footer"><span>LOOKOUT / ALPHA 0.1</span><span>Observed {new Date(project.observedAt).toLocaleString("en-GB")}</span></footer>
    </main>
  );
}
