import { describe, expect, it, vi } from "vitest";
vi.mock("@lookout/db", () => ({
  authoriseAgentToken: vi.fn(async (token:string) =>
    token==="lkp_"+"a".repeat(64)?{id:5,projectId:7,label:"Agent"}:null),
  authoriseOAuthAccessToken: vi.fn(async (raw:string) => raw==="lk_oat_chatgpt_demo"?
    {scope:"lookout:read lookout:contribute",clientId:"https://chatgpt.com/"}:null),
  getPortfolioIdForObservedProject:vi.fn(async (observed:number)=>observed===7?3:null),
  getSharedHandoverContext:vi.fn(async (portfolio:number,observed?:number)=>({
    project:{portfolioId:portfolio},revision:2,legacyCursor:"3:12",current:[],earlierReports:[],
    observedProjectId:observed??null
  })),
  getHandoverReconciliation:vi.fn(async (_id:number,eventId:string)=>({eventId,revision:3,
    reconciliation:{status:"incorporated",trust:"agent_reported"}})),
  submitReconciledHandover:vi.fn(async ()=>({id:21,revision:3,duplicate:false,
    reconciliation:{status:"incorporated",trust:"agent_reported"}})),
  getPortfolio:vi.fn(async()=>({projects:[],attention:[],workDecisions:[]})),
  getLogicalPortfolio:vi.fn(async()=>({projects:[],coverage:{}})),
  getProject:vi.fn(async()=>({project:null,findings:[],decisions:[]})),
  getAgentHandover:vi.fn(async()=>null),
  getPortfolioContributionHandover:vi.fn(async()=>null),
  getInfrastructurePortfolio:vi.fn(async()=>({resources:[],findings:[]})),
  getLinkedResources:vi.fn(async()=>[]),
  listPortfolioContributions:vi.fn(async()=>[]),
  listChatgptContributions:vi.fn(async()=>[]),
  HandoverEventConflictError:class extends Error {}
}));
import {POST} from "../app/api/mcp/route";
import {getSharedHandoverContext,submitReconciledHandover} from "@lookout/db";
import type {NextRequest} from "next/server";

const token="lkp_"+"a".repeat(64);
async function call(method:string,params:unknown,credential=token){
 const url="https://lookout.example/api/mcp";
 const request=new Request(url,{
   method:"POST",headers:{Authorization:"Bearer "+credential,
     "Content-Type":"application/json",Accept:"application/json, text/event-stream"},
   body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})
 }) as NextRequest;
 Object.defineProperty(request,"nextUrl",{value:new URL(url)});
 const response=await POST(request);
 const data=await response.text();
 const dataLine=data.split("\n").find(line=>line.startsWith("data: "));
 return {status:response.status,
   body:JSON.parse(dataLine?dataLine.slice(6):data)};
}
const report={
 eventId:"claude-session-012",agent:"Claude",title:"Repaired import",
 aim:"Repair preview import",summary:"Adjusted importer; production unchanged",
 basedOnRevision:2,basedOnLegacyCursor:"3:12",workstream:"uk-import",next:"Verify full coverage",
 done:["Parser updated"],notDone:["Mobile acceptance"],decisions:[],
 blockers:[],addresses:[]
};
describe("revision-aware hosted MCP",()=>{
 it("lets project-scoped agents read shared context with their verified project scope",async()=>{
   const response=await call("tools/call",{name:"lookout_get_context",arguments:{}});
   expect(response.status).toBe(200);
   expect(getSharedHandoverContext).toHaveBeenCalledWith(3,7);
   expect(response.body.result.content[0].text).toContain('"revision":2');
 });
 it("does not let a project token select an unrelated portfolio",async()=>{
   const response=await call("tools/call",{
     name:"lookout_get_context",arguments:{portfolioId:44}
   });
   expect(JSON.stringify(response.body)).toContain("cannot select");
 });
 it("submits a revision-aware handover through the scoped project identity",async()=>{
   const response=await call("tools/call",{name:"lookout_submit_handover",arguments:report});
   expect(response.status).toBe(200);
   expect(submitReconciledHandover).toHaveBeenCalledWith(3,"agent","coding-agent:5",report);
   expect(response.body.result.content[0].text).toContain('"revision":3');
 });
 it("lets authorised ChatGPT contribute to its selected logical project",async()=>{
   const token="lk_oat_chatgpt_demo";
   const context=await call("tools/call",{
     name:"lookout_get_context",arguments:{portfolioId:3}
   },token);
   expect(context.status).toBe(200);
   expect(getSharedHandoverContext).toHaveBeenCalledWith(3,undefined);
   const write=await call("tools/call",{
     name:"lookout_submit_handover",arguments:{...report,portfolioId:3}
   },token);
   expect(write.status).toBe(200);
   expect(submitReconciledHandover).toHaveBeenCalledWith(3,"chatgpt","ChatGPT",report);
 });
 it("keeps unauthorised owner bearer tokens read-only",async()=>{
   const owner="b".repeat(64);
   const prev=process.env.LOOKOUT_MCP_OWNER_TOKEN;
   process.env.LOOKOUT_MCP_OWNER_TOKEN=owner;
   try {
     const response=await call("tools/list",{},owner);
     const tools=response.body.result.tools as Array<{name:string}>;
     expect(tools.some(t=>t.name==="lookout_get_context")).toBe(true);
     expect(tools.some(t=>t.name==="lookout_submit_handover")).toBe(false);
   } finally {
     if(prev===undefined)delete process.env.LOOKOUT_MCP_OWNER_TOKEN;
     else process.env.LOOKOUT_MCP_OWNER_TOKEN=prev;
   }
 });
});
