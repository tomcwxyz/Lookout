import Link from "next/link";
import { ScanControls } from "./components/scan-controls";
import { deriveWorkHandover } from "@lookout/core";
import { workStageLabels } from "./components/work-handover";
import { databaseConfigured, getPortfolio, getInfrastructurePortfolio } from "@lookout/db";

export const dynamic = "force-dynamic";

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function Home() {
  let data: Awaited<ReturnType<typeof getPortfolio>> | null = null;
  let error: string | null = null;
  if (databaseConfigured()) {
    try { data = await getPortfolio(); }
    catch { error = "Database unavailable or migration not yet applied. Check DATABASE_URL and run npm run db:migrate."; }
  }
  const infrastructure = databaseConfigured() ? await getInfrastructurePortfolio().catch(() => null) : null;
  const infraAttention = infrastructure?.findings.length ?? 0;
  const allProjects = data?.projects ?? [];
  const items = data?.attention ?? [];
  const handovers = allProjects.map(project => ({ project, work: deriveWorkHandover(project.snapshot) }));
  const workQueue = handovers
    .map(entry => ({ ...entry, signal: entry.work.items.find(item =>
      ["needs_testing", "needs_review", "in_progress", "possibly_paused", "planned"].includes(item.stage)) }))
    .filter(entry => entry.signal !== undefined)
    .sort((a, b) => {
      const rank = (stage: string) => ["needs_testing", "needs_review", "in_progress", "possibly_paused", "planned"].indexOf(stage);
      return rank(a.signal!.stage) - rank(b.signal!.stage);
    }).slice(0, 12);
  const projectCount = new Set(items.map(item => item.projectId)).size;
  const branches = allProjects.reduce((count, project) => count + project.snapshot.branches.length, 0);
  const prs = allProjects.reduce((count, project) => count + project.snapshot.pullRequests.length, 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-icon">◉</span><span>lookout<span className="brand-dot">.</span></span></Link>
        <div className="side-label">WORKSPACE</div>
        <nav className="nav">
          <Link href="/" className="nav-link active"><span>▦</span> Overview</Link>
          <a href="#attention" className="nav-link"><span>◇</span> Attention inbox <span className="nav-count">{items.length}</span></a>
          <a href="#projects" className="nav-link"><span>⌁</span> Projects</a>
          <Link href="/infrastructure" className="nav-link"><span>♧</span> Infrastructure {infraAttention > 0 && <span className="nav-count">{infraAttention}</span>}</Link>
        </nav>
        <div className="sidebar-bottom"><div className="pulse-dot" /> Observation mode <span className="muted">· Read-only</span></div>
      </aside>

      <main className="content">
        <div className="topline"><span>PORTFOLIO / OVERVIEW</span><span>{data?.latestRun ? "Last synchronised " + dateLabel(data.latestRun.finishedAt ?? data.latestRun.startedAt) : "Awaiting first sync"}</span></div>
        <header className="hero">
          <div><span className="eyebrow">YOUR DEVELOPMENT PORTFOLIO</span><h1>Keep everything <em>in sight.</em></h1><p>Changes, unfinished work, infrastructure and the things that need your attention — all in one place.</p></div>
          <div className="hero-mark" aria-hidden="true"><div className="radar-ring ring-1" /><div className="radar-ring ring-2" /><div className="radar-ring ring-3" /><div className="radar-centre" /></div>
        </header>

        {(!databaseConfigured() || error) && <section className="notice"><strong>Connect your workspace</strong><p>{error ?? "Add DATABASE_URL and GITHUB_TOKEN to your .env file, apply the migration, then run the synchronisation worker. No sample data is shown as if it were real."}</p><code>npm run db:migrate &amp;&amp; npm run sync</code></section>}

        <ScanControls />

        <section className="work-portfolio">
          <div className="work-heading"><div><span className="eyebrow">WHERE DID I LEAVE THINGS?</span><h2>Work to pick up</h2></div>
            <span className="count-pill">{workQueue.length} projects highlighted</span></div>
          <p className="work-caution">A handover based on available PRs, issues and plans. Suggested statuses are not confirmed delivery decisions.</p>
          {workQueue.length === 0 ? <p className="muted">No work signals yet. Scan GitHub to gather recent changes and planning files.</p> :
            <div className="work-queue">{workQueue.map(({ project, signal }) =>
              <div className="work-queue-row" key={project.id}>
                <div><Link href={"/projects/" + project.id} className="work-project-name">{project.name}</Link>
                  <span className={"work-status-label stage-" + signal!.stage}>{workStageLabels[signal!.stage]}</span>
                  <p>{signal!.title}</p></div>
                <a href={signal!.evidenceUrl} target="_blank" rel="noopener noreferrer">Evidence ↗</a>
              </div>
            )}</div>}
        </section>

        <div className="metrics">
          <div className="metric"><span>Tracked projects</span><strong>{allProjects.length}</strong><small>Repositories observed</small></div>
          <div className="metric"><span>Need attention</span><strong className="accent-amber">{projectCount}</strong><small>{items.length} open findings</small></div>
          <div className="metric"><span>Open pull requests</span><strong>{prs}</strong><small>Across tracked projects</small></div>
          <div className="metric"><span>Git branches</span><strong>{branches}</strong><small>Infrastructure alerts: {infraAttention}</small></div>
        </div>

        <div className="dashboard-grid">
          <section className="panel" id="attention">
            <div className="panel-heading"><div><span className="eyebrow">PRIORITISED SIGNALS</span><h2>Needs your attention</h2></div><span className="count-pill">{items.length}</span></div>
            {items.length === 0 ? <div className="empty"><span className="empty-icon">◎</span><h3>Nothing flagged yet</h3><p>When observation runs find ageing branches, stale PRs or failed workflows, they'll appear here with evidence.</p></div> :
              <div className="attention-list">{items.slice(0, 30).map(item =>
                <article className="attention-row" key={item.id}>
                  <span className={item.severity === "critical" ? "signal critical" : "signal warning"} />
                  <div className="attention-body"><span className="overline">{item.slug} · {item.kind.replaceAll("_", " ")}</span><h3>{item.title}</h3><p>{item.explanation}</p><a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">View evidence ↗</a></div>
                </article>)}</div>}
          </section>
          <section className="panel projects-panel" id="projects">
            <div className="panel-heading"><div><span className="eyebrow">CONNECTED CODEBASES</span><h2>Your projects</h2></div><span className="count-pill">{allProjects.length}</span></div>
            {allProjects.length === 0 ? <div className="empty"><span className="empty-icon">⌘</span><h3>No projects discovered</h3><p>Run the worker with a read-only GitHub token to discover repositories and build their first project snapshots.</p></div> :
              <div className="project-list">{allProjects.map(project => {
                const pending = items.filter(item => item.projectId === project.id);
                return <Link className="project-row" key={project.id} href={"/projects/" + project.id}>
                  <div className="project-avatar">{project.name.slice(0, 2).toUpperCase()}</div><div className="project-body"><strong>{project.name}</strong><small>{project.slug}</small><span>{deriveWorkHandover(project.snapshot).nextStep}</span></div><div className="project-side">{pending.length ? <span className="mini-alert">{pending.length} to review</span> : <span className="mini-clear">Observed</span>}<small>{dateLabel(project.observedAt)}</small></div>
                </Link>;
              })}</div>}
          </section>
        </div>
        <footer className="footer"><span>LOOKOUT / ALPHA 0.1</span><span>Evidence first. Suggestions, not assumptions.</span></footer>
      </main>
    </div>
  );
}
