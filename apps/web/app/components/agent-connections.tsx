"use client";
import { useState } from "react";

type Token = {id:number;label:string;prefix:string;createdAt:string;revokedAt:string|null};
export function AgentConnections({projectId,initialTokens}:{
  projectId:number; initialTokens:Token[];
}) {
  const [tokens,setTokens]=useState(initialTokens);
  const [label,setLabel]=useState("My coding agent");
  const [newToken,setNewToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function create(){
    if(busy||!label.trim()) return;
    setBusy(true); setMessage(""); setNewToken("");
    try {
      const response=await fetch("/api/agent/tokens",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId,label})});
      const data=await response.json() as {id?:number;token?:string;error?:string};
      if(!response.ok||!data.token) throw new Error(data.error??"Token could not be created");
      setNewToken(data.token);
      await refresh();
      setMessage("Token created. Copy it now; Lookout cannot show it again.");
    } catch(err){setMessage(err instanceof Error?err.message:"Request failed");}
    finally{setBusy(false);}
  }
  async function refresh(){
    const response=await fetch("/api/agent/tokens?projectId="+projectId,{cache:"no-store"});
    if(response.ok){const data=await response.json() as {tokens:Token[]};setTokens(data.tokens);}
  }
  async function revoke(id:number){
    if(!confirm("Revoke this agent connection? Any agent using its token will lose access.")) return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/agent/tokens",{method:"DELETE",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId,tokenId:id})});
      if(!response.ok) throw new Error("Unable to revoke");
      if(newToken) setNewToken("");
      await refresh(); setMessage("Access revoked.");
    } catch{setMessage("Could not revoke the token.");}
    finally{setBusy(false);}
  }
  return <details className="agent-connection">
    <summary>Connect a coding agent <span className="agent-connection-count">{tokens.filter(x=>!x.revokedAt).length} active</span></summary>
    <p className="work-caution">Create a separate token for each coding agent. It can read this project's bounded handover and propose checkpoints, but cannot change GitHub, deploy code, or accept completed work.</p>
    <div className="agent-connection-form">
      <label>Connection name
        <input maxLength={90} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Codex on Windows" />
      </label>
      <button type="button" disabled={busy||!label.trim()} onClick={()=>void create()}>Generate project token</button>
    </div>
    {newToken && <div className="agent-token-reveal" role="status">
      <strong>Copy this token now — it will not be shown again.</strong>
      <code>{newToken}</code>
      <button type="button" onClick={()=>void navigator.clipboard.writeText(newToken)}>Copy token</button>
      <button type="button" onClick={()=>setNewToken("")}>I've saved it</button>
    </div>}
    {message && <p role="status" className="agent-status">{message}</p>}
    <div className="agent-token-list">
      {tokens.map(token=><div key={token.id} className="agent-token-row">
        <div><strong>{token.label}</strong><small>{token.prefix}… · {token.revokedAt?"Revoked":"Active"}</small></div>
        {!token.revokedAt && <button type="button" disabled={busy} onClick={()=>void revoke(token.id)}>Revoke</button>}
      </div>)}
    </div>
    <p className="work-caution">Use <code>LOOKOUT_API_URL=https://lookout-eosin.vercel.app</code> and <code>LOOKOUT_API_TOKEN</code> with the local Lookout MCP bridge. Store the token in your agent's private configuration, never in the repository.</p>
  </details>;
}
