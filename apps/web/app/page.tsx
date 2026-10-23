import Link from "next/link";
import { ScanControls } from "./components/scan-controls";
import { deriveWorkHandover } from "@lookout/core";
import { workStageLabels, confirmedStageLabels, effectiveWorkStatus } from "./components/work-handover";
import { databaseConfigured, getPortfolio, getInfrastructurePortfolio, getLogicalPortfolio, listPortfolioContributions, listChatgptContributions } from "@lookout/db";

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
  const logical = databaseConfigured() ? await getLogicalPortfolio().catch(() => null) : null;
  const infraAttention = infrastructure?.findings.length ?? 0;
  const agentRecent = (await Promise.all((logical?.projects ?? []).map(async p => {
 const [agents,chatgpt]=await Promise.all([listPortfolioContributions(p.id,5).catch(()=>[]),listChatgptContributions(p.id).catch(()=>[])]);
 return [...agents.map(a=>({id:"agent-"+a.id,agent:a.agent,title:a.title,summary:a.payload.summary,recordedAt:new Date(a.recordedAt)})),...chatgpt.map(c=>{const payload=c.payload as {title?:string;summary?:string};return {id:"chatgpt-"+c.id,agent:"ChatGPT",title:payload.title??"ChatGPT contribution",summary:payload.summary??"",recordedAt:new Date(String(c.recorded_at))};})];
 }))).flat().sort((a,b) => b.recordedAt.getTime()-a.recordedAt.getTime()).slice(0,5);
  const allProjects = data?.projects ?? [];
  const items = data?.attention ?? [];
  const decisions = data?.workDecisions ?? [];
  const handovers = allProjects.map(project => ({
    project, work: deriveWorkHandover(project.snapshot),
    decisions: decisions.filter(d => d.projectId === project.id)
  }));
  const workQueue = handovers.map(entry => {
    const options = entry.work.items.map(item => ({
      signal: item, stage: effectiveWorkStatus(item, entry.decisions)
    })).filter(item => !["complete", "marked_done", "maintenance"].includes(item.stage));
    const rank = (stage: string) => [
      "checks_failing", "changes_requested", "needs_testing", "needs_review", "needs_tidy", "review_approved", "in_progress",
      "possibly_paused", "on_hold", "scoped_not_built", "awaiting_decision", "planned", "integrated", "maintenance"
    ].indexOf(stage);
    options.sort((x, y) => rank(x.stage) - rank(y.stage));
    return { ...entry, item: options[0] };
  }).filter(entry => entry.item !== undefined).sort((a, b) => {
    const priorities = ["checks_failing", "changes_requested", "needs_testing", "needs_review", "needs_tidy", "review_approved", "in_progress", "possibly_paused", "on_hold", "scoped_not_built", "awaiting_decision", "planned", "integrated", "maintenance"];
    return priorities.indexOf(a.item!.stage) - priorities.indexOf(b.item!.stage);
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
          <Link href="/portfolio" className="nav-link"><span>⌁</span> Project portfolio</Link>
          <Link href="/agents" className="nav-link"><span>✦</span> Agent activity</Link>
          <Link href="/demo" className="nav-link"><span>✧</span> Explore demo</Link>
          <Link href="/connections" className="nav-link"><span>⌘</span> Web chat connection</Link>
          <Link href="/infrastructure" className="nav-link"><span>♧</span> Infrastructure {infraAttention > 0 && <span className="nav-count">{infraAttention}</span>}</Link>
        </nav>
        <div className="sidebar-bottom"><div className="pulse-dot" /> Observation mode <span className="muted">· Sources read-only</span></div>
      </aside>

      <main className="content">
        <div className="topline"><span>PORTFOLIO / OVERVIEW</span><span>{data?.latestRun ? "Last synchronised " + dateLabel(data.latestRun.finishedAt ?? data.latestRun.startedAt) : "Awaiting first sync"}</span></div>
        <header className="hero dashboard-hero">
          <div><span className="eyebrow">YOUR DEVELOPMENT PORTFOLIO</span><h1>Know what needs <em>attention.</em></h1><p>A connected view of development work, reported agent progress and independently observed infrastructure. Every claim has a source.</p></div>
          <div className="hero-mark" aria-hidden="true"><div className="radar-ring ring-1" /><div className="radar-ring ring-2" /><div className="radar-ring ring-3" /><div className="radar-centre" /></div>
        </header>

        {(!databaseConfigured() || error) && <section className="notice"><strong>Connect your workspace</strong><p>{error ?? "Add DATABASE_URL and GITHUB_TOKEN to your .env file, apply the migration, then run the synchronisation worker. No sample data is shown as if it were real."}</p><code>npm run db:migrate &amp;&amp; npm run sync</code></section>}

        <ScanControls />

<section className="dashboard-intelligence" aria-label="Portfolio intelligence">
          <div className="intelligence-heading"><div><span className="eyebrow">TODAY / YOUR WORKSPACE</span><h2>Where things stand</h2><p>Start with the decisions that need you. Agent reports are labelled as claims, not verified changes.</p></div><Link href="/portfolio">Explore all projects →</Link></div>
          <div className="intelligence-grid">
            <article className="panel intelligence-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIONABLE WORK</span><h2>Needs attention</h2></div><span className="count-pill">{workQueue.length} projects</span></div>
              {workQueue.length===0?<p className="padded muted">No outstanding work identified in recent inspected sources.</p>:workQueue.slice(0,5).map(({project,item})=><div className="intelligence-entry" key={project.id}><div><Link href={"/projects/"+project.id}><strong>{project.name}</strong></Link><span className={"work-status-label stage-"+item!.stage}>{confirmedStageLabels[item!.stage]??workStageLabels[item!.stage as keyof typeof workStageLabels]}</span></div><p>{item!.signal.title}</p><small>{item!.signal.nextAction??"Review available evidence before acting"}</small></div>)}
              <a className="intelligence-more" href="#attention">Review all source findings ↓</a></article>
            <article className="panel intelligence-panel"><div className="panel-heading"><div><span className="eyebrow">PROJECT MEMORY</span><h2>Agent activity</h2></div><Link href="/agents" className="count-pill">All reports →</Link></div>
              {agentRecent.length===0?<div className="empty"><h3>No contributions yet</h3><p>Connect a coding assistant using a project-scoped token to capture progress, blockers and handovers.</p></div>:agentRecent.map(report=><div className="intelligence-entry" key={report.id}><div><strong>{report.agent}</strong><span className="mini-alert">Unverified report</span></div><p>{report.title}</p><small>{report.summary} · {dateLabel(report.recordedAt)}</small></div>)}
            </article>
          </div>
        </section>
        <section className="work-portfolio" id="work-queue">
          <div className="work-heading"><div><span className="eyebrow">WHERE DID I LEAVE THINGS?</span><h2>Work to pick up</h2></div>
            <span className="count-pill">{workQueue.length} projects highlighted</span></div>
          <p className="work-caution">A handover based on available PRs, issues and plans. Suggested statuses can be corrected and confirmed from each project page.</p>
          {workQueue.length === 0 ? <p className="muted">No work signals yet. Scan GitHub to gather recent changes and planning files.</p> :
            <div className="work-queue">{workQueue.map(({ project, item }) =>
              <div className="work-queue-row" key={project.id}>
                <div><Link href={"/projects/" + project.id} className="work-project-name">{project.name}</Link>
                  <span className={"work-status-label stage-" + item!.stage}>{confirmedStageLabels[item!.stage] ?? workStageLabels[item!.stage as keyof typeof workStageLabels]}</span>
                  <p className="work-queue-pr-title">{item!.signal.title}</p>
                  {item!.signal.summary && <p className="work-queue-summary">{item!.signal.summary}</p>}
                  {item!.signal.nextAction && <p className="work-queue-next"><strong>Next:</strong> {item!.signal.nextAction}</p>}</div>
                <a href={item!.signal.evidenceUrl} target="_blank" rel="noopener noreferrer">Evidence ↗</a>
              </div>
            )}</div>}
        </section>

        <div className="metrics">
          <div className="metric"><span>Portfolio projects</span><strong>{logical?.projects.length ?? allProjects.length}</strong><small>{logical?.coverage.inventoriedRepositories ?? allProjects.length} repos inventoried · {logical?.coverage.detailedRepositories ?? allProjects.length} inspected</small></div>
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
            <div className="panel-heading"><div><span className="eyebrow">CONNECTED CODEBASES</span><h2>Your projects</h2></div><Link href="/portfolio" className="count-pill">All {logical?.projects.length ?? allProjects.length} projects →</Link></div>
            {allProjects.length === 0 ? <div className="empty"><span className="empty-icon">⌘</span><h3>No projects discovered</h3><p>Run the worker with a read-only GitHub token to discover repositories and build their first project snapshots.</p></div> :
              <div className="project-list">{allProjects.slice(0, 12).map(project => {
                const pending = items.filter(item => item.projectId === project.id);
                return <Link className="project-row" key={project.id} href={"/projects/" + project.id}>
                  <div className="project-avatar">{project.name.slice(0, 2).toUpperCase()}</div><div className="project-body"><strong>{project.name}</strong><small>{project.slug}</small><span>{handovers.find(x => x.project.id === project.id)?.decisions.length ? 'Work status reviewed · ' : ''}{deriveWorkHandover(project.snapshot).nextStep}</span></div><div className="project-side">{pending.length ? <span className="mini-alert">{pending.length} to review</span> : <span className="mini-clear">Observed</span>}<small>{dateLabel(project.observedAt)}</small></div>
                </Link>;
              })}</div>}
          </section>
        </div>
        <footer className="footer"><span>LOOKOUT / ALPHA 0.1</span><span>Evidence first. Suggestions, not assumptions.</span></footer>
      </main>
    </div>
  );
}
