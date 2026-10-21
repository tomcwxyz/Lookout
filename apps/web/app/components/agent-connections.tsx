"use client";
import { useState } from "react";

type Token = {id:number;label:string;prefix:string;createdAt:string;revokedAt:string|null};
export function AgentConnections({projectId,initialTokens}:{
  projectId:number; initialTokens:Token[];
}) {
  const [tokens,setTokens]=useState(initialTokens);
  const [assistant,setAssistant]=useState<"codex"|"claude"|"other">("codex");
  const [copied,setCopied]=useState(false);
  const [newToken,setNewToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function create(){
    if(busy) return;
    setBusy(true); setMessage(""); setNewToken(""); setCopied(false);
    try {
      const response=await fetch("/api/agent/tokens",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId,label:assistant==="codex"?"Codex":assistant==="claude"?"Claude Code":"Other MCP assistant"})});
      const data=await response.json() as {id?:number;token?:string;error?:string};
      if(!response.ok||!data.token) throw new Error(data.error??"Token could not be created");
      setNewToken(data.token);
      await refresh();
      setMessage("Connection prepared. Copy the setup command into your terminal. The credential is only shown during setup.");
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
  const active=tokens.filter(t=>!t.revokedAt);
  const url=typeof window==="undefined"?"https://lookout-eosin.vercel.app":window.location.origin;
  const shellQuote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
  const reliableCommand=newToken?
    (assistant==="codex"
      ? "codex mcp add lookout --env LOOKOUT_API_URL="+shellQuote(url)+" --env LOOKOUT_API_TOKEN="+shellQuote(newToken)
      : assistant==="claude"
        ? "claude mcp add --transport stdio --env LOOKOUT_API_URL="+shellQuote(url)+" --env LOOKOUT_API_TOKEN="+shellQuote(newToken)+" lookout"
        : "")+
    " -- npx -y @goodship/lookout-mcp@0.2.0":"";
  return <section className="agent-connection">
    <div className="agent-setup-heading"><div><span className="eyebrow">PROJECT CONNECTIONS</span>
      <h2>Connect your coding assistant</h2>
      <p className="work-caution">Share project handovers between coding sessions. Your assistant can suggest progress updates, not mark work as complete.</p></div>
      <span className="agent-connection-count">{active.length} configured</span></div>
    <div className="agent-choices" role="group" aria-label="Choose coding assistant">
      {(["codex","claude","other"] as const).map(option=><button key={option} type="button"
        className={assistant===option?"selected":""} disabled={busy||Boolean(newToken)}
        onClick={()=>setAssistant(option)}>{option==="codex"?"Codex":option==="claude"?"Claude Code":"Other MCP assistant"}</button>)}
    </div>
    {!newToken?<button type="button" className="agent-setup-primary" disabled={busy}
      onClick={()=>void create()}>{busy?"Preparing…":"Prepare connection"}</button>:
      <div className="agent-token-reveal" role="status">
        <strong>Connection ready for {assistant==="codex"?"Codex":assistant==="claude"?"Claude Code":"your assistant"}</strong>
        <p className="work-caution">Paste this command into your terminal after the Lookout MCP package is published. No repository checkout needed.</p>
        {assistant==="other"?<><p>Use the following values in your assistant's MCP server configuration:</p>
          <code>LOOKOUT_API_URL={url}</code><code>LOOKOUT_API_TOKEN={newToken}</code>
          <p>Command after package publication: <code>npx -y @goodship/lookout-mcp@0.2.0</code></p></>:
          <><code className="agent-setup-command">{reliableCommand}</code>
          <button type="button" onClick={async()=>{await navigator.clipboard.writeText(reliableCommand);setCopied(true);}}>
            {copied?"Copied ✓":"Copy setup command"}</button></>}
        <button type="button" onClick={()=>{setNewToken("");setCopied(false);}}>Done</button>
      </div>}
    {message&&<p role="status" className="agent-status">{message}</p>}
    <details className="agent-manage"><summary>Manage connections ({active.length})</summary>
      <p className="work-caution">A configured connection is not proof the assistant is online. Once connected, request a project handover to check access.</p>
      <div className="agent-token-list">{tokens.map(token=><div key={token.id} className="agent-token-row">
        <div><strong>{token.label}</strong><small>{token.prefix}… · {token.revokedAt?"Revoked":"Configured — not yet verified"}</small></div>
        {!token.revokedAt&&<button type="button" disabled={busy} onClick={()=>void revoke(token.id)}>Revoke</button>}
      </div>)}</div>
    </details>
  </section>;
}
