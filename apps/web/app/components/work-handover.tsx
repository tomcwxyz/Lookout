import type { WorkHandover, WorkStage } from "@lookout/core";

export const workStageLabels: Record<WorkStage, string> = {
  needs_testing: "Testing needed",
  needs_review: "Human review",
  in_progress: "In progress",
  possibly_paused: "Possibly paused",
  integrated: "Merged · verify",
  planned: "Planned · unverified",
  marked_done: "Marked complete"
};

export function WorkHandoverPanel({ handover }: { handover: WorkHandover }) {
  const priorities: WorkStage[] = [
    "needs_testing", "needs_review", "in_progress", "possibly_paused",
    "planned", "integrated", "marked_done"
  ];
  const hasSignals = handover.items.length > 0;
  return <section className="work-handover" aria-labelledby="work-heading">
    <div className="work-heading">
      <div><span className="eyebrow">WHERE DID I LEAVE THIS?</span><h2 id="work-heading">Current work and next steps</h2></div>
      <span className="count-pill">{handover.items.length} evidence signals</span>
    </div>
    <p className="work-next"><strong>Suggested next step</strong> {handover.nextStep}</p>
    <p className="work-caution">Statuses are interpretations of GitHub evidence, not verified delivery decisions. A merged PR is not automatically released or accepted.</p>
    {!hasSignals && <p className="muted padded">No recent work signals available yet. Try refreshing the GitHub observation.</p>}
    {priorities.map(stage => {
      const matches = handover.items.filter(item => item.stage === stage);
      if (!matches.length) return null;
      return <div className="work-group" key={stage}>
        <h3><span className={"work-dot stage-" + stage} /> {workStageLabels[stage]} <small>{matches.length}</small></h3>
        <div className="work-items">{matches.slice(0, stage === "planned" ? 10 : 6).map(item =>
          <a className="work-entry" href={item.evidenceUrl} key={item.key} target="_blank" rel="noopener noreferrer">
            <span className="work-entry-title">{item.title}</span>
            <span className="work-entry-description">{item.explanation}</span>
            <span className="work-entry-source">{item.evidenceType === "plan" ? "Plan" : item.evidenceType === "issue" ? "Issue" : "Pull request"} · View source ↗</span>
          </a>
        )}</div>
        {matches.length > (stage === "planned" ? 10 : 6) && <p className="work-overflow">+{matches.length - (stage === "planned" ? 10 : 6)} more signals in this category</p>}
      </div>;
    })}
    <div className="work-plan-links">
      <strong>Planning references</strong>
      {handover.plans.length ? handover.plans.map(plan =>
        <a key={plan.path} href={plan.url} target="_blank" rel="noopener noreferrer">{plan.path} ↗</a>
      ) : <span>No planning file found in the sampled folders.</span>}
      <small>{handover.coverage}</small>
    </div>
  </section>;
}
