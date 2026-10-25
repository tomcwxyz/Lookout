"use client";
import {useActionState,useEffect,useState} from "react";
import {useFormStatus} from "react-dom";
import {createReadOnlyConnection,type McpKeyResult} from "./actions";

const initial:McpKeyResult={token:null,expiresAt:null,error:null};
function SubmitButton(){
 const {pending}=useFormStatus();
 return <button type="submit" disabled={pending}>{pending?"Creating…":"Create read-only connection"}</button>;
}
export function McpKeyCreator(){
 const [result,action]=useActionState(createReadOnlyConnection,initial);
 const [endpoint,setEndpoint]=useState("/api/mcp");
 const [copied,setCopied]=useState(false);
 useEffect(()=>setEndpoint(window.location.origin+"/api/mcp"),[]);
 return <div className="lookout-mcp-creator">
  <p>Create a personal, read-only key for a compatible MCP client. It can read only projects assigned to this organisation, and cannot update projects or submit agent reports.</p>
  <form action={action} className="portfolio-form" style={{padding:0}}>
   <label htmlFor="mcp-key-name">Connection name</label>
   <input id="mcp-key-name" name="name" minLength={3} maxLength={80} required placeholder="My desktop assistant" />
   <SubmitButton/>
  </form>
  {result.error&&<p className="notice" role="alert">{result.error}</p>}
  {result.token&&<section className="lookout-mcp-onetime" aria-label="New connection credential">
   <strong>Copy your key now. It will not be shown again.</strong>
   <p>Your key expires {result.expiresAt?new Date(result.expiresAt).toLocaleDateString("en-GB"):"after 90 days"}. Treat it like a password.</p>
   <code className="lookout-mcp-token">{result.token}</code>
   <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(result.token!);setCopied(true)}catch{setCopied(false)}}}>
    {copied?"Copied":"Copy key"}
   </button>
  </section>}
  <p className="lookout-mcp-endpoint"><strong>MCP endpoint:</strong> <code>{endpoint}</code></p>
  <p className="work-caution">Use a Bearer-authenticated MCP client and the tools <code>lookout_whoami</code>, <code>lookout_list_projects</code>, <code>lookout_list_attention</code>, and <code>lookout_list_agent_reports</code>. ChatGPT OAuth account connections are a separate step; a Bearer key does not automatically connect the ChatGPT app.</p>
 </div>;
}
