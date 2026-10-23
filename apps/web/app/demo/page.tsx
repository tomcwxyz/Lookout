"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { demoEvents, demoProjects, demoStories } from "./fixtures";
type Tab = "attention"|"changes"|"agents"|"projects";
const sourceLabel = { github:"GitHub observation",agent:"Agent-reported",human:"Human-confirmed",vercel:"Vercel observation",neon:"Neon observation" };
export default function DemoPage() {
 const [tab,setTab]=useState<Tab>("attention");
 const [selected,setSelected]=useState<string|null>(null);
 const [search,setSearch]=useState("");
 const events=useMemo(()=>demoEvents.filter(e=>!selected||e.projectId===selected),[selected]);
 const projects=useMemo(()=>demoProjects.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())),[search]);
 const visible=tab==="agents"?events.filter(e=>e.source==="agent"):tab==="attention"?events.filter(e=>e.projectId==="harbour"||e.projectId==="canopy"):events;
 return <div className="app">
  <aside className="sidebar">
   <Link href="/demo" className="brand"><span className="brand-icon">◉</span><span>lookout<span className="brand-dot">.</span></span></Link>
   <div className="side-label">FICTIONAL WORKSPACE</div>
   <nav className="nav"><button className="nav-link active" onClick={()=>{setTab("attention");setSelected(null)}}>◎ Overview</button><button className="nav-link" onClick={()=>setTab("projects")}>⌁ Projects</button><button className="nav-link" onClick={()=>setTab("agents")}>✦ Agent activity</button></nav>
   <div className="sidebar-bottom">Demo data only · No live connections</div>
  </aside>
  <main className="content" style={{maxWidth:1250}}>
   <div className="topline"><span>LOOKOUT / INTERACTIVE SHOWCASE</span><strong>FICTIONAL DATA — PUBLIC DEMO</strong></div>
   <header className="hero"><div><span className="eyebrow">EXPLORE LOOKOUT</span><h1>Know where everything <em>stands.</em></h1><p>GitHub evidence, deployments, human decisions and AI agent handovers — brought together so the next person knows what happened and what comes next.</p></div></header>
   <div className="notice" role="note"><strong>Illustrative workspace</strong><p>Everything on this page is synthetic. The repositories, accounts, agents, CI checks and deployments are fictional. Nothing here reads or changes your real projects.</p></div>
   <div className="metrics">
    <div className="metric"><span>Projects</span><strong>{demoProjects.length}</strong><small>Fictional portfolio</small></div>
    <div className="metric"><span>Need attention</span><strong>{demoProjects.filter(p=>p.health!=="healthy").length}</strong><small>Blockers and reviews</small></div>
    <div className="metric"><span>Agent reports</span><strong>{demoEvents.filter(e=>e.source==="agent").length}</strong><small>Unverified contributions</small></div>
    <div className="metric"><span>Observed events</span><strong>{demoEvents.filter(e=>e.source!=="agent").length}</strong><small>Example external evidence</small></div>
   </div>
   <section className="panel" style={{marginBottom:20}}>
    <div className="panel-heading"><div><span className="eyebrow">GUIDED EXPLORATION</span><h2>Choose a story</h2></div></div>
    <div className="demo-story-grid">{demoStories.map(story=><button key={story.id} className="demo-story" onClick={()=>{setSelected(story.id);setTab("changes")}}><strong>{story.title} →</strong><span>{story.description}</span></button>)}</div>
   </section>
   <div className="demo-tabs" role="group" aria-label="Demo views">
    {(["attention","changes","agents","projects"] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)} className={tab===t?"selected":""}>{({attention:"Needs attention",changes:"What changed",agents:"Agent activity",projects:"Projects"} as const)[t]}</button>)}
   </div>
   {selected&&<div className="demo-filter"><strong>Viewing: {demoProjects.find(p=>p.id===selected)?.name}</strong><button onClick={()=>setSelected(null)}>Clear filter ×</button></div>}
   {tab==="projects"?<section className="panel">
    <div className="panel-heading"><h2>Portfolio</h2><input className="demo-search" aria-label="Search demonstration projects" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {projects.map(p=><button className="project-row demo-project" key={p.id} onClick={()=>{setSelected(p.id);setTab("changes")}}><div className="project-avatar">{p.name.slice(0,2).toUpperCase()}</div><div className="project-body"><strong>{p.name}</strong><small>{p.category} · {p.repos.join(" · ")}</small><span>{p.summary}</span><span>Next: {p.next}</span></div><div className="project-side"><span className={p.health==="healthy"?"mini-clear":"mini-alert"}>{p.stage}</span></div></button>)}
    {!projects.length&&<p className="padded">No matching fictional projects.</p>}
   </section>:<section className="panel">
    <div className="panel-heading"><div><span className="eyebrow">PROVENANCE-FIRST INTELLIGENCE</span><h2>{tab==="agents"?"Agent contributions":tab==="attention"?"Items to review":"Evidence timeline"}</h2></div><span className="count-pill">{visible.length} events</span></div>
    {visible.map(ev=><article className="attention-row" key={ev.id}><span className={"signal"+(!ev.verified?" critical":"")}/><div className="attention-body"><span className="overline">{demoProjects.find(p=>p.id===ev.projectId)?.name} · {ev.when} · {sourceLabel[ev.source]}</span><h3>{ev.title}</h3><p>{ev.details}</p><span className={ev.verified?"mini-clear":"mini-alert"}>{ev.verified?(ev.source==="human"?"Confirmed human decision":"Example source observation"):"Unverified agent claim"}</span></div></article>)}
    {visible.length===0&&<p className="padded">No example events for this selection.</p>}
   </section>}
   <footer className="footer"><span>LOOKOUT / FICTIONAL DEMONSTRATION</span><span>Evidence first. Claims are not confirmations.</span></footer>
  </main>
 </div>;
}
