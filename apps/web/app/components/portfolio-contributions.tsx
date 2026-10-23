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

function SessionDetails({payload}:{payload:CheckpointInput}) {
 const next=payload.remaining.find(text=>text.startsWith("Next: "));
 const unfinished=payload.remaining.filter(text=>!text.startsWith("Next: "));
 return <div className="pr-evidence-section">
   {payload.objective && <p><strong>Aim:</strong> {payload.objective}</p>}
   {payload.implemented.length>0 && <div><strong>What was done</strong><ul>{payload.implemented.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
   {unfinished.length>0 && <div><strong>Not finished</strong><ul>{unfinished.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
   {payload.decisions.length>0 && <div><strong>Decisions reported</strong><ul>{payload.decisions.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
   {next && <p><strong>Pick up next:</strong> {next.slice(6)}</p>}
 </div>;
}

export function PortfolioContributions({ contributions, chatgptContributions, setupLinks }: {
  contributions: Contribution[];
  chatgptContributions: Array<{ id: unknown; kind: unknown; payload: unknown; recorded_at: unknown }>;
  setupLinks: Array<{ id: number; slug: string }>;
}) {
  return <section className="panel portfolio-edit" aria-labelledby="contribution-title">
    <div className="panel-heading"><div><span className="eyebrow">AGENTS / PROJECT MEMORY</span>
      <h2 id="contribution-title">Session notes and agent activity</h2></div>
      <span className="count-pill">{contributions.length + chatgptContributions.length} recent</span></div>
    <p className="portfolio-contribution-help">Reports are attributed, append-only and <strong>agent-reported</strong>.
      They do not confirm delivery, CI success or a project's lifecycle status.</p>
    {!contributions.length && !chatgptContributions.length && <p className="muted padded">No session notes yet. Connected agents can record what was done, what remains, decisions and where to resume.</p>}
    <div className="agent-timeline portfolio-contribution-timeline">
      {chatgptContributions.map(item => {
       const payload=item.payload as CheckpointInput;
       return <article className="agent-timeline-entry" key={"chatgpt-"+String(item.id)}>
        <div className="agent-timeline-top"><span className="agent-source agent-source-agent">ChatGPT · {String(item.kind)} · unverified</span><time>{new Date(String(item.recorded_at)).toLocaleString("en-GB")}</time></div>
        <h3>{payload.title}</h3><p>{payload.summary}</p><SessionDetails payload={payload} /><small>ChatGPT via Lookout OAuth · Portfolio contribution</small>
        <details className="pr-evidence-details"><summary>Claimed work and remaining actions</summary><p><strong>Objective:</strong> {payload.objective}</p>{payload.remaining?.length>0 && <ul>{payload.remaining.map((task,i)=><li key={i}>{task}</li>)}</ul>}</details>
       </article>;
      })}
      {contributions.map(item => <article className="agent-timeline-entry" key={item.id}>
        <div className="agent-timeline-top">
          <span className="agent-source agent-source-agent">{labels[item.kind] ?? item.kind} · unverified</span>
          <time dateTime={item.recordedAt.toISOString()}>{item.recordedAt.toLocaleString("en-GB")}</time>
        </div>
        <h3>{item.title}</h3>
        <p>{item.payload.summary}</p>
        <SessionDetails payload={item.payload} />
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
