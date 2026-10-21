#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
const remoteUrl=process.env.LOOKOUT_API_URL?.replace(/\/+$/,"");
const remoteToken=process.env.LOOKOUT_API_TOKEN;
if(!remoteUrl||!remoteToken) throw new Error("LOOKOUT_API_URL and LOOKOUT_API_TOKEN are required");
const parsed=new URL(remoteUrl);
if(parsed.protocol!=="https:" && !(["localhost","127.0.0.1"].includes(parsed.hostname)&&process.env.LOOKOUT_ALLOW_LOCAL_HTTP==="true"))
 throw new Error("Lookout API requires HTTPS");
async function remote(path,body){
 const response=await fetch(remoteUrl+path,{method:body===undefined?"GET":"POST",
 headers:{Authorization:"Bearer "+remoteToken,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 if(!response.ok) throw new Error("Lookout API HTTP "+response.status);
 return response.json();
}
function result(value){return {content:[{type:"text",text:JSON.stringify(value)}]};}
function createServer(){
 const server=new McpServer({name:"lookout",version:"0.2.0"});
  /** Remote mode never requires a Neon database credential on the coding agent's machine. */
  {
    server.registerTool("lookout_get_handover", {
      description:"Retrieve bounded, evidence-linked project state, agent-reported checkpoints and human decisions to resume development.",
      inputSchema:z.object({})
    }, async()=>{
      try{return result(await remote("/api/agent/handover"));}
      catch(err){return {isError:true,content:[{type:"text",text:String(err)}]};}
    });
    server.registerTool("lookout_get_decisions", {
      description:"Get explicit human project decisions; agent claims do not override these.",
      inputSchema:z.object({})
    }, async()=>{
      try {const d=await remote("/api/agent/handover") as {humanDecisions:unknown};
        return result(d.humanDecisions);}
      catch(err){return {isError:true,content:[{type:"text",text:String(err)}]};}
    });
    server.registerTool("lookout_get_next_actions", {
      description:"Retrieve open checkpoint tasks and current PRs, with evidence and trust labels.",
      inputSchema:z.object({})
    },async()=>{
      try {const d=await remote("/api/agent/handover") as {
        latestCheckpoints:Array<{nextStep:string;title:string;id:number;agent:string;recordedAt:string}>;
        openPullRequests:unknown;humanDecisions:unknown
      };
        return result({agentReportedNextSteps:d.latestCheckpoints.slice(0,5).map(c=>({
          checkpointId:c.id,title:c.title,agent:c.agent,recordedAt:c.recordedAt,nextStep:c.nextStep,
          trust:"agent_reported"})),openPullRequests:d.openPullRequests,humanDecisions:d.humanDecisions});}
      catch(err){return {isError:true,content:[{type:"text",text:String(err)}]};}
    });
    server.registerTool("lookout_propose_checkpoint", {
      description:"Submit a bounded agent-reported progress checkpoint. Does NOT confirm task completion or overwrite human decisions. Do not include secrets or raw conversation transcripts.",
      inputSchema:z.object({
        version:z.literal(1),eventId:z.string().min(6).max(120),agent:z.string().min(1).max(80),
        title:z.string().min(1).max(180),objective:z.string().min(1).max(1000),
        summary:z.string().min(1).max(2500),branch:z.string().max(200).optional(),
        commitSha:z.string().max(64).optional(),prUrl:z.string().url().optional(),
        implemented:z.array(z.string().max(300)).max(12),
        remaining:z.array(z.string().max(300)).max(12),
        tests:z.array(z.object({description:z.string().max(300),result:
          z.enum(["passed_claimed","failed_claimed","not_run","needs_human"])})).max(12),
        decisions:z.array(z.string().max(300)).max(10),
        blockers:z.array(z.string().max(300)).max(10),
        capturedAt:z.string().optional()
      })
    }, async(checkpoint)=>{
      try{return result(await remote("/api/agent/checkpoints",{checkpoint}));}
      catch(err){return {isError:true,content:[{type:"text",text:String(err)}]};}
    });
  }

 return server;
}
const server=createServer();
await serveStdio(server);
