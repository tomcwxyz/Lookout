import type { CheckpointInput } from "@lookout/core";
type AgentRecord = { id:number;eventId:string;agent:string;title:string;payload:CheckpointInput;
  recordedAt:Date;status:string;nextStep:string };
type HumanDecision = {workKey:string;status:string;note:string|null;updatedAt:Date};
type Merge = {number:number;title:string;url:string;mergedAt:string};
type TimelineEvent = {
  key:string;timestamp:number;kind:"agent"|"merge"|"human";title:string;detail:string;
  trust:string;url?:string;checkpoint?:CheckpointInput;
};
export function ProjectActivity({checkpoints,merges,decisions}:{
  checkpoints:AgentRecord[];merges:Merge[];decisions:HumanDecision[];
}){
  const events:TimelineEvent[]=[
    ...checkpoints.map(x=>({key:"agent-"+x.id,timestamp:new Date(x.recordedAt).getTime(),
      kind:"agent" as const,title:x.title,detail:x.nextStep,trust:"Agent-reported · awaiting verification",checkpoint:x.payload})),
    ...merges.map(x=>({key:"merge-"+x.number,timestamp:Date.parse(x.mergedAt),
      kind:"merge" as const,title:x.title,detail:"Merged into Git — acceptance not verified",
      trust:"GitHub observed",url:x.url})),
    ...decisions.map(x=>({key:"human-"+x.workKey,timestamp:new Date(x.updatedAt).getTime(),
      kind:"human" as const,title:"Status confirmed: "+x.status.replaceAll("_"," "),
      detail:x.note??x.workKey,trust:"Human-confirmed"}))
  ].sort((a,b)=>b.timestamp-a.timestamp).slice(0,24);
  return <section className="work-handover project-activity" aria-labelledby="activity-title">
    <div className="work-heading"><div><span className="eyebrow">ACROSS CODING SESSIONS</span>
      <h2 id="activity-title">Project activity and handovers</h2></div>
      <span className="count-pill">{events.length} recent events</span></div>
    <p className="work-caution">Agent updates, GitHub merges and human decisions are different evidence types. They are not interchangeable.</p>
    {!events.length && <p className="muted">No agent checkpoints or recent decisions yet. Connect a coding agent to start a project handover history.</p>}
    <div className="agent-timeline">{events.map(item=><article key={item.key} className="agent-timeline-entry">
      <div className="agent-timeline-top">
        <span className={"agent-source agent-source-"+item.kind}>{item.trust}</span>
        <time dateTime={new Date(item.timestamp).toISOString()}>{new Date(item.timestamp).toLocaleString("en-GB")}</time>
      </div>
      <h3>{item.url?<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a>:item.title}</h3>
      <p>{item.detail}</p>
      {item.checkpoint && <details className="pr-evidence-details"><summary>What the agent reported</summary>
        <p><strong>Objective:</strong> {item.checkpoint.objective}</p>
        <p>{item.checkpoint.summary}</p>
        {([
          ["Claims of implementation",item.checkpoint.implemented],
          ["Remaining actions",item.checkpoint.remaining],
          ["Decisions reported",item.checkpoint.decisions],
          ["Blockers",item.checkpoint.blockers]
        ] as const).filter(([,x])=>x.length).map(([name,lines])=><div className="pr-evidence-section" key={name}>
          <strong>{name}</strong><ul>{lines.map((line,i)=><li key={i}>{line}</li>)}</ul></div>)}
        {item.checkpoint.tests.length>0&&<div className="pr-evidence-section"><strong>Tests claimed</strong>
          <ul>{item.checkpoint.tests.map((x,i)=><li key={i}>{x.description} — {x.result.replaceAll("_"," ")}</li>)}</ul></div>}
        {(item.checkpoint.prUrl||item.checkpoint.commitSha)&&<p className="work-caution">
          References: {item.checkpoint.prUrl?<a href={item.checkpoint.prUrl} target="_blank" rel="noopener noreferrer">PR ↗</a>:null}
          {" "}{item.checkpoint.commitSha?.slice(0,10)}</p>}
      </details>}
    </article>)}</div>
  </section>;
}
