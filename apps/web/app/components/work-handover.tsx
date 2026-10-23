import type { WorkHandover, WorkStage } from "@lookout/core";
import { WorkDecisionControl } from "./work-decision";

export const workStageLabels: Record<WorkStage, string> = {
  checks_failing: "Checks failing",
  changes_requested: "Changes requested",
  needs_testing: "Testing needed",
  review_approved: "Review approved · verify",
  awaiting_decision: "Open · assess next step",
  maintenance: "Automated maintenance",
  needs_review: "Human review",
  in_progress: "In progress",
  possibly_paused: "Possibly paused",
  integrated: "Merged · verify",
  planned: "Planned · unverified",
  marked_done: "Marked complete in plan"
};
export const confirmedStageLabels: Record<string, string> = {
  complete: "Confirmed complete",
  needs_tidy: "Tidy-up remains",
  needs_testing: "Testing needed",
  needs_review: "Human review",
  in_progress: "In progress",
  on_hold: "On hold",
  scoped_not_built: "Scoped, not built"
};
type Decision = { workKey: string; status: string; note: string | null };
const stages = [
  "checks_failing", "changes_requested", "needs_testing", "needs_review",
  "needs_tidy", "review_approved", "in_progress", "possibly_paused",
  "on_hold", "scoped_not_built", "awaiting_decision", "planned",
  "integrated", "complete", "marked_done", "maintenance"
];

export function effectiveWorkStatus(item: { key: string; stage: WorkStage }, decisions: Decision[]) {
  return decisions.find(d => d.workKey === item.key)?.status ?? item.stage;
}

/** The source record and a human confirmation remain visibly distinct. */
export function WorkHandoverPanel({ handover, decisions, projectId, readOnly = false }: {
  handover: WorkHandover; decisions: Decision[]; projectId: number; readOnly?: boolean
}) {
  const items = handover.items.map(item => ({
    ...item, decision: decisions.find(d => d.workKey === item.key),
    effectiveStage: effectiveWorkStatus(item, decisions)
  }));
  const actionable = items.find(item => !["complete", "marked_done", "integrated", "maintenance"].includes(item.effectiveStage));
  const next = actionable ?? items.find(item => item.effectiveStage === "integrated");
  const nextStep = next ? (
    next.effectiveStage === "integrated" ? "Confirm delivery and acceptance: " :
    next.effectiveStage === "needs_tidy" ? "Finish follow-up: " :
    next.effectiveStage === "scoped_not_built" ? "Decide whether to build: " :
    next.effectiveStage === "on_hold" ? "Decide whether to resume: " :
    next.effectiveStage === "checks_failing" ? "Investigate checks: " :
    next.effectiveStage === "changes_requested" ? "Address review feedback: " :
    next.effectiveStage === "review_approved" ? "Verify readiness: " :
    next.effectiveStage === "awaiting_decision" ? "Assess next step: " :
    next.effectiveStage === "needs_testing" ? "Arrange testing: " :
    next.effectiveStage === "needs_review" ? "Review: " : "Pick up: "
  ) + (next.nextAction ?? next.title) : "No open work identified from available evidence.";
  return <section className="work-handover" aria-labelledby="work-heading">
    <div className="work-heading">
      <div><span className="eyebrow">WHERE DID I LEAVE THIS?</span><h2 id="work-heading">Current work and next steps</h2></div>
      <span className="count-pill">{items.length} work signals</span>
    </div>
    <p className="work-next"><strong>Suggested next step</strong> {nextStep}</p>
    <p className="work-caution">Signals come from GitHub. Confirmations are yours and survive later scans. Neither a merge nor a ticked roadmap task proves release or acceptance.</p>
    {!items.length && <p className="muted padded">No recent work signals available. Refresh the GitHub scan to gather planning and delivery evidence.</p>}
    {stages.map(stage => {
      const matches = items.filter(item => item.effectiveStage === stage);
      if (!matches.length) return null;
      const label = confirmedStageLabels[stage] ?? workStageLabels[stage as WorkStage] ?? stage;
      const visible = matches.slice(0, stage === "planned" ? 10 : 6);
      return <div className="work-group" key={stage}>
        <h3><span className={"work-dot stage-" + stage} /> {label} <small>{matches.length}</small></h3>
        <div className="work-items">{visible.map(item =>
          <article className="work-entry" key={item.key}>
            <a className="work-entry-title" href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">{item.title} ↗</a>
            <span className="work-entry-description">{item.explanation}</span>
            {item.summary && <p className="pr-context-summary"><strong>What this is:</strong> {item.summary}</p>}
            {item.nextAction && <p className="pr-next-action"><strong>Suggested next action:</strong> {item.nextAction}</p>}
            {item.context && (item.context.changes.length > 0 || item.context.remaining.length > 0 ||
              item.context.testing.length > 0 || item.context.risks.length > 0 || item.context.discussion.length > 0) &&
              <details className="pr-evidence-details">
                <summary>PR evidence and discussion</summary>
                {([
                  ["What the PR says changed", item.context.changes],
                  ["Outstanding in the PR", item.context.remaining],
                  ["Testing described in the PR", item.context.testing],
                  ["Risks and limitations", item.context.risks],
                  ["Recent discussion (not a decision)", item.context.discussion]
                ] as const).filter(([, lines]) => lines.length > 0).map(([heading, lines]) =>
                  <div className="pr-evidence-section" key={heading}>
                    <strong>{heading}</strong>
                    <ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
                  </div>
                )}
              </details>}
            {(item.checks || item.reviewStatus) && <div className="pr-review-evidence">
              {item.reviewStatus && <span>Review: {item.reviewStatus.replaceAll("_", " ")}</span>}
              {item.checks && <span>Checks: {item.checks}</span>}
            </div>}
            <span className="work-entry-source">{item.evidenceType === "plan" ? "Planning document" : item.evidenceType === "issue" ? "Issue" : "Pull request"}
              {item.decision && " · Status confirmed by you"}</span>
            {item.decision?.note && <span className="work-confirmed-note">Your note: {item.decision.note}</span>}
            {!readOnly && <WorkDecisionControl key={item.key + ":" + (item.decision?.status ?? "")} projectId={projectId} workKey={item.key}
              initialStatus={item.decision?.status ?? null} initialNote={item.decision?.note ?? null}/>}
          </article>
        )}</div>
        {matches.length > visible.length && <p className="work-overflow">+{matches.length - visible.length} more signals in this category</p>}
      </div>;
    })}
    <div className="work-plan-links">
      <strong>Planning references</strong>
      {handover.plans.length ? handover.plans.map(plan =>
        <a key={plan.path} href={plan.url} target="_blank" rel="noopener noreferrer">{plan.path} ↗</a>
      ) : <span>No plan found in sampled locations.</span>}
      <small>{handover.coverage}</small>
    </div>
  </section>;
}
