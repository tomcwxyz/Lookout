import type { CheckpointInput } from "@lookout/core";

type Contribution = {
  id: number; kind: string; eventId: string; agent: string; title: string;
  tokenLabel: string; repository: string; recordedAt: Date; trust: "agent_reported";
  payload: CheckpointInput; nextStep: string;
};
const labels: Record<string, string> = {
  progress: "Progress", evidence: "Evidence claim", blocker: "Blocker",
  handover: "Handover", next_action: "Proposed action"
};
export function PortfolioContributions({ contributions, setupLinks }: {
  contributions: Contribution[];
  setupLinks: Array<{ id: number; slug: string }>;
}) {
  return <section className="panel portfolio-edit" aria-labelledby="contribution-title">
    <div className="panel-heading"><div><span className="eyebrow">AGENTS / PROJECT MEMORY</span>
      <h2 id="contribution-title">Agent contributions</h2></div>
      <span className="count-pill">{contributions.length} recent</span></div>
    <p className="portfolio-contribution-help">Reports are attributed, append-only and <strong>agent-reported</strong>.
      They do not confirm delivery, CI success or a project's lifecycle status.</p>
    {!contributions.length && <p className="muted padded">No agent contributions yet. Connect a coding agent and ask it to submit a progress report or handover.</p>}
    <div className="agent-timeline portfolio-contribution-timeline">
      {contributions.map(item => <article className="agent-timeline-entry" key={item.id}>
        <div className="agent-timeline-top">
          <span className="agent-source agent-source-agent">{labels[item.kind] ?? item.kind} · unverified</span>
          <time dateTime={item.recordedAt.toISOString()}>{item.recordedAt.toLocaleString("en-GB")}</time>
        </div>
        <h3>{item.title}</h3>
        <p>{item.payload.summary}</p>
        <small>{item.agent} via {item.tokenLabel} · {item.repository}</small>
        <details className="pr-evidence-details"><summary>Evidence, tests and next actions</summary>
          <p><strong>Objective:</strong> {item.payload.objective}</p>
          <p><strong>Suggested next step:</strong> {item.nextStep}</p>
          {([
            ["Implemented (claimed)", item.payload.implemented],
            ["Remaining", item.payload.remaining],
            ["Decisions mentioned (not confirmed)", item.payload.decisions],
            ["Blockers", item.payload.blockers]
          ] as const).filter(([,items]) => items.length > 0).map(([label,items]) =>
            <div className="pr-evidence-section" key={label}><strong>{label}</strong>
              <ul>{items.map((text,i) => <li key={i}>{text}</li>)}</ul></div>)}
          {item.payload.tests.length > 0 && <div className="pr-evidence-section">
            <strong>Tests (agent claims only)</strong><ul>
              {item.payload.tests.map((test,i) => <li key={i}>{test.description}: {test.result.replaceAll("_"," ")}</li>)}
            </ul></div>}
          {item.payload.prUrl && <a href={item.payload.prUrl} target="_blank" rel="noopener noreferrer">Referenced pull request ↗</a>}
          {item.payload.commitSha && <p>Commit reference: <code>{item.payload.commitSha}</code></p>}
        </details>
      </article>)}
    </div>
    {setupLinks.length > 0 ? <p className="portfolio-contribution-help">
      Connect a coding agent via {setupLinks.map((link,i) => <span key={link.id}>
        {i > 0 ? " · " : ""}<a href={"/projects/" + link.id}>{link.slug}</a>
      </span>)}. The existing project-scoped token also authorises contribution reporting.
    </p> : <p className="portfolio-contribution-help">
      This project has no detailed repository observation yet. Agent contribution tokens currently require a linked observed repository.
    </p>}
  </section>;
}
