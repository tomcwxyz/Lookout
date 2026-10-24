"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import "../demo/demo.css";

type Finding={id:number;projectId:number;project:string;severity:string;title:string;explanation:string;url:string;at:string};
type Project={id:number;name:string;description:string;status:string|null;repositories:number};
type Report={id:string;portfolioId:number;projectName:string;agent:string;kind:string;title:string;summary:string;nextStep:string;recordedAt:string;blockerCount:number;remainingCount:number};
type Resource={id:number;name:string;provider:string;kind:string;url:string;observedAt:string};
type View="attention"|"changes"|"agents"|"projects";
const labelDate=(v:string)=>Number.isNaN(Date.parse(v))?"Date unavailable":new Date(v).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
export function WorkspaceExplorer({findings,projects,reports,resources}:{
 findings:Finding[];projects:Project[];reports:Report[];resources:Resource[];
}){
 const [tab,setTab]=useState<View>("attention");
 const [selected,setSelected]=useState<number|null>(null);
 const [search,setSearch]=useState("");
 const attention=useMemo(()=>[...findings].sort((a,b)=>(a.severity==="critical"?0:1)-(b.severity==="critical"?0:1)||Date.parse(b.at)-Date.parse(a.at)),[findings]);
 const filteredFindings=attention.filter(item=>selected===null||item.projectId===selected);
 const filteredReports=reports.filter(item=>selected===null||item.portfolioId===selected);
 const agentFollowUps=filteredReports.filter(r=>r.blockerCount>0||r.remainingCount>0).sort((a,b)=>b.blockerCount-a.blockerCount||Date.parse(b.recordedAt)-Date.parse(a.recordedAt));
 const filteredProjects=projects.filter(item=>(selected===null||item.id===selected)&&item.name.toLowerCase().includes(search.trim().toLowerCase()));
 const recentChanges=useMemo(()=>[
  ...findings.map(item=>({key:"finding-"+item.id,kind:"GitHub observation",title:item.title,details:item.explanation,at:item.at,projectId:item.projectId,url:item.url})),
  ...reports.map(item=>({key:"report-"+item.id,kind:"Unverified agent report",title:item.title,details:item.summary,at:item.recordedAt,projectId:item.portfolioId,url:"/portfolio/"+item.portfolioId})),
  ...resources.map(item=>({key:"resource-"+item.id,kind:item.provider+" observation",title:item.name+" · "+item.kind.replaceAll("_"," "),details:"Observed cloud resource; this alone does not prove health or release acceptance.",at:item.observedAt,projectId:null as number|null,url:item.url}))
 ].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)),[findings,reports,resources]);
 const selectedName=selected===null?null:projects.find(p=>p.id===selected)?.name;
 const count=tab==="attention"?filteredFindings.length:tab==="agents"?filteredReports.length:tab==="changes"?recentChanges.filter(e=>selected===null||e.projectId===selected).length:filteredProjects.length;
 return <section className="lookout-workspace-explorer" aria-label="Explore your workspace">
  <div className="work-heading"><div><span className="eyebrow">WORKSPACE INTELLIGENCE / LIVE RECORDS</span><h2>Where things stand</h2>
    <p className="work-caution" style={{marginTop:9}}>Explore your real observations and unverified reports. A finding is something to review, not a confirmed instruction.</p></div></div>
  <div className="demo-tabs" role="group" aria-label="Choose intelligence view">
    {(["attention","changes","agents","projects"] as const).map(view=>
      <button type="button" key={view} aria-pressed={tab===view} className={tab===view?"selected":""}
      onClick={()=>setTab(view)}>{view==="attention"?"Needs attention":view==="changes"?"What changed":view==="agents"?"Agent activity":"Projects"}</button>)}
  </div>
  {selectedName && <div className="demo-filter"><strong>Project: {selectedName}</strong><button onClick={()=>setSelected(null)}>Clear filter ×</button></div>}
  <section className="panel">
   <div className="panel-heading"><div><span className="eyebrow">{tab==="agents"?"SELF-REPORTED / UNVERIFIED":tab==="changes"?"LATEST RECORDED EVIDENCE":tab==="attention"?"EVIDENCE-BACKED FINDINGS":"ORGANISATION PORTFOLIO"}</span>
    <h2>{tab==="attention"?"Needs your review":tab==="changes"?"What changed":tab==="agents"?"Agent handovers":"Your projects"}</h2></div>
    {tab==="projects"?<input aria-label="Search your projects" className="demo-search" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/>:<span className="count-pill">{count} {count===1?"record":"records"}</span>}
   </div>
   {tab==="attention"&&agentFollowUps.length>0&&<div className="lookout-agent-signals" style={{borderBottom:"1px solid #e4eae6",background:"#f7faf8",padding:"15px 23px"}}>
    <span className="eyebrow">REPORTED BY AGENTS · NEEDS VERIFICATION</span>
    <p className="work-caution" style={{margin:"7px 0 12px"}}>These handovers flag reported blockers or unfinished work. They are suggestions to investigate, not confirmed faults or automatically accepted priorities.</p>
    {agentFollowUps.slice(0,5).map(report=><div className="intelligence-entry" key={report.id} style={{padding:"11px 0"}}>
     <div><strong>{report.projectName}: {report.title}</strong><span className="mini-alert">{report.blockerCount} reported blockers · {report.remainingCount} remaining</span></div>
     <p><strong>Review next:</strong> {report.nextStep}</p>
     <Link className="back-link" href={"/portfolio/"+report.portfolioId}>Review project evidence →</Link>
    </div>)}
   </div>}
   {tab==="attention"&&(filteredFindings.length?filteredFindings.slice(0,60).map(item=><article key={item.id} className="attention-row">
    <span className={item.severity==="critical"?"signal critical":"signal warning"}/>
    <div className="attention-body"><span className="overline">{item.project} · {labelDate(item.at)} · GitHub observation</span>
     <h3>{item.title}</h3><p>{item.explanation}</p><a href={item.url} target="_blank" rel="noopener noreferrer">Examine source ↗</a>
     <span style={{marginLeft:12}}><button className="back-link" style={{border:0,background:"none",cursor:"pointer"}} onClick={()=>{setSelected(item.projectId);setTab("changes")}}>Project history →</button></span>
    </div></article>):<p className="padded muted">No recorded findings for this selection. Check the source freshness above before interpreting this as a clean bill of health.</p>)}
   {tab==="changes"&&(recentChanges.filter(e=>selected===null||e.projectId===selected).slice(0,60).map(item=><article key={item.key} className="attention-row">
    <span className="signal"/><div className="attention-body"><span className="overline">{item.kind} · {labelDate(item.at)}</span>
    <h3>{item.title}</h3><p>{item.details}</p><a href={item.url} target={item.url.startsWith("/")?undefined:"_blank"} rel="noopener noreferrer">Review evidence ↗</a></div>
   </article>))}
   {tab==="agents"&&(filteredReports.length?filteredReports.map(item=><article key={item.id} className="attention-row">
    <span className="signal warning"/><div className="attention-body">
     <span className="overline">{item.projectName} · {item.agent} · {labelDate(item.recordedAt)} · Unverified</span>
     <h3>{item.title}</h3><p>{item.summary||"No summary recorded."}</p><p><strong>Suggested next:</strong> {item.nextStep}</p>
     <Link href={"/portfolio/"+item.portfolioId}>Project context →</Link></div>
   </article>):<div className="empty"><h3>No agent handovers recorded</h3><p>Agent MCP reporting is available for existing owner and project tokens, but this organisation has no recorded handovers yet. Missing reports do not imply completed work.</p></div>)}
   {tab==="projects"&&(filteredProjects.length?filteredProjects.map(p=><div className="project-row" key={p.id}>
      <div className="project-avatar">{p.name.slice(0,2).toUpperCase()}</div><div className="project-body">
      <Link href={"/portfolio/"+p.id}><strong>{p.name}</strong></Link>
      <small>{p.repositories} linked {p.repositories===1?"repository":"repositories"} · {p.status?.replaceAll("_"," ")??"Status unconfirmed"}</small>
      <span>{p.description||"No description recorded."}</span></div>
      <button className="back-link" onClick={()=>{setSelected(p.id);setTab("attention")}} style={{border:0,background:"none",cursor:"pointer",fontSize:12}}>View signals →</button>
    </div>):<p className="padded muted">No matching projects in this organisation.</p>)}
   {tab==="attention"&&filteredFindings.length>60&&<p className="padded muted">Showing the first 60 findings, with critical findings first. Refine to a project to investigate further.</p>}
   {tab==="changes"&&count===0&&<p className="padded muted">No observations or reports match this project.</p>}
  </section>
 </section>;
}
