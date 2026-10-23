import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { databaseConfigured, getPortfolio, getProject, getInfrastructurePortfolio, getLinkedResources, saveIdea } from "@lookout/db";

const remoteUrl = process.env.LOOKOUT_API_URL?.replace(/\/+$/, "");
const remoteToken = process.env.LOOKOUT_API_TOKEN;
if (!databaseConfigured() && !(remoteUrl && remoteToken))
  throw new Error("Lookout MCP requires DATABASE_URL or LOOKOUT_API_URL plus LOOKOUT_API_TOKEN");
if (remoteUrl) {
  const parsed=new URL(remoteUrl);
  const local=parsed.hostname==="localhost" || parsed.hostname==="127.0.0.1";
  if(parsed.protocol!=="https:" && !(local && process.env.LOOKOUT_ALLOW_LOCAL_HTTP==="true"))
    throw new Error("Lookout remote API must use HTTPS (or explicit local HTTP for development)");
}
async function remote(path:string, body?:unknown) {
  if(!remoteUrl || !remoteToken) throw new Error("Remote Lookout connection unavailable");
  const response=await fetch(remoteUrl+path,{
    method:body===undefined?"GET":"POST",
    headers:{Authorization:"Bearer "+remoteToken,Accept:"application/json",
      ...(body===undefined?{}:{"Content-Type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(30000)
  });
  const value=await response.json() as unknown;
  if(!response.ok) throw new Error("Lookout API returned HTTP "+response.status);
  return value;
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function createServer() {
  const server = new McpServer({ name: "lookout", version: "0.1.0" });

  if (databaseConfigured()) server.registerTool("list_projects", {
    description: "List observed software projects, their last observation and rule-based summary.",
    inputSchema: z.object({})
  }, async () => {
    const data = await getPortfolio();
    return result(data.projects.map(p => ({
      id: p.id, name: p.name, slug: p.slug, url: p.url,
      summary: p.ruleSummary, observedAt: p.observedAt,
      aiBrief: p.aiBrief
    })));
  });

  if (databaseConfigured()) server.registerTool("list_attention", {
    description: "List currently open evidence-backed attention items across all projects.",
    inputSchema: z.object({})
  }, async () => {
    const data = await getPortfolio();
    return result(data.attention);
  });

  if (databaseConfigured()) server.registerTool("get_project_context", {
    description: "Retrieve a project's observed Git branches, PRs, latest CI result, ideas and open findings. Missing sources are unknown, never assumed healthy.",
    inputSchema: z.object({ projectId: z.number().int().positive() })
  }, async ({ projectId }) => {
    const data = await getProject(projectId);
    if (!data.project) return { isError: true, content: [{ type: "text", text: "Project not found" }] };
    return result({
      project: data.project.name, slug: data.project.slug,
      observedAt: data.project.observedAt, ruleSummary: data.project.ruleSummary,
      aiBrief: data.project.aiBrief, snapshot: data.project.snapshot,
      attention: data.findings, ideas: data.ideas
    });
  });

  if (databaseConfigured()) server.registerTool("list_infrastructure", {
    description: "List read-only observed Neon and Vercel resources, their explicit/verified project associations, evidence and attention items.",
    inputSchema: z.object({})
  }, async () => {
    const data = await getInfrastructurePortfolio();
    return result({ resources: data.resources, findings: data.findings, syncs: data.syncs });
  });

  if (databaseConfigured()) server.registerTool("get_project_infrastructure", {
    description: "List observed cloud resources associated with one Lookout project. A link is not evidence that a database migration has run.",
    inputSchema: z.object({ projectId: z.number().int().positive() })
  }, async ({ projectId }) => result(await getLinkedResources(projectId)));

  if (databaseConfigured()) server.registerTool("capture_idea", {
    description: "Capture a low-risk idea or note without creating a GitHub issue. Requires explicit LOOKOUT_MCP_WRITE_ENABLED=true.",
    inputSchema: z.object({
      projectId: z.number().int().positive().optional(),
      title: z.string().min(1).max(240),
      note: z.string().max(5000).optional()
    })
  }, async ({ projectId, title, note }) => {
    if (process.env.LOOKOUT_MCP_WRITE_ENABLED !== "true") {
      return { isError: true, content: [{ type: "text", text: "Idea capture is disabled; set LOOKOUT_MCP_WRITE_ENABLED=true for this local MCP process." }] };
    }
    const [idea] = await saveIdea({ projectId, title, note });
    return result({ id: idea.id, title: idea.title, status: idea.status });
  });


  /** Remote mode never requires a Neon database credential on the coding agent's machine. */
  if (remoteUrl && remoteToken) {
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
    // A human-readable session note is the preferred write format. Translate it to
    // the existing v1 checkpoint API, preserving all existing clients and storage.
    // Technical evidence continues to be observed independently by Lookout.
    server.registerTool("lookout_record_session", {
      description:"At the end of meaningful work, record a concise, plain-English session handover: aim, outcomes, unfinished work, decisions and the next action. Do not repeat GitHub technical details. Only report what actually happened; unverified work remains agent-reported. Do not submit on every tool call.",
      inputSchema:z.object({
        eventId:z.string().min(6).max(120),
        agent:z.string().min(1).max(80),
        title:z.string().min(1).max(180),
        aim:z.string().min(1).max(1000),
        done:z.array(z.string().min(1).max(300)).max(12),
        notDone:z.array(z.string().min(1).max(300)).max(12),
        decisions:z.array(z.string().min(1).max(300)).max(10),
        next:z.string().min(1).max(300),
        context:z.string().max(1500).optional(),
        blockers:z.array(z.string().min(1).max(300)).max(10).optional(),
        evidenceUrl:z.string().url().optional()
      })
    }, async(note)=>{
      const checkpoint={
        version:1 as const,eventId:note.eventId,agent:note.agent,title:note.title,
        objective:note.aim,
        summary:note.context?.trim() || [
          "Aim: "+note.aim,
          "Next: "+note.next
        ].join("\n"),
        implemented:note.done,
        remaining:[...note.notDone, "Next: "+note.next].slice(0,12),
        tests:[],
        decisions:note.decisions,
        blockers:note.blockers||[],
        ...(note.evidenceUrl?{prUrl:note.evidenceUrl}:{})
      };
      try{return result(await remote("/api/agent/checkpoints",{checkpoint}));}
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

// stdio transports must never write logs to stdout.
try {
  serveStdio(createServer);
} catch (error) {
  console.error("Lookout MCP failed:", error);
  process.exitCode = 1;
}
