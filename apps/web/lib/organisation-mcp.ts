import {McpServer} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {listTenantPortfolioProjects,authorisedPortfolioProject,listOrganisationMcpFindings,listWorkspaceReports} from "@lookout/db";
import type {HostedMcpIdentity} from "./hosted-mcp-auth";

const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false} as const;
const content=(data:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(data)}]});
type OrganisationIdentity=Extract<HostedMcpIdentity,{scope:"organisation"}>;

/** Separate limited tool set; owner and project-token MCP code is unchanged.
 * No write tools, provider keys or cross-organisation portfolio queries.
 */
export function createOrganisationMcpServer(identity:OrganisationIdentity){
 const server=new McpServer({name:"lookout",version:"0.4.0"});
 server.registerTool("lookout_whoami",{
  description:"Show the active Lookout organisation and read-only scope. This is not an owner-wide connection.",
  inputSchema:z.object({}),annotations:readOnly
 },async()=>content({scope:"organisation",organisation:identity.name,readOnly:true,
   contributionWrite:false,permission:"portfolio:read",note:"Projects and reports are limited to this organisation."}));
 server.registerTool("lookout_list_projects",{
  description:"List only logical projects explicitly assigned to the connected Lookout organisation.",
  inputSchema:z.object({}),annotations:readOnly
 },async()=>content({projects:await listTenantPortfolioProjects(identity.organisationId),
   trustNote:"Human-confirmed lifecycle status is distinct from GitHub observation."}));
 server.registerTool("lookout_list_attention",{
  description:"List up to 100 open source findings from this organisation's granted repositories; includes supporting evidence URLs.",
  inputSchema:z.object({}),annotations:readOnly
 },async()=>content({findings:await listOrganisationMcpFindings(identity.organisationId),
   trustNote:"Source observations may be stale. Their severity is not human acceptance."}));
 server.registerTool("lookout_list_agent_reports",{
  description:"Read up to 50 unverified agent handovers for this organisation, including blockers and suggested follow-up.",
  inputSchema:z.object({}),annotations:readOnly
 },async()=>content({reports:await listWorkspaceReports(identity.organisationId,50),
   trustNote:"Agent claims are unverified and cannot change the project lifecycle."}));
 server.registerTool("lookout_get_portfolio_project",{
  description:"Read one organisation-authorised project. A guessed project ID outside the organisation returns not found.",
  inputSchema:z.object({portfolioId:z.number().int().positive()}),annotations:readOnly
 },async({portfolioId})=>{
  const project=await authorisedPortfolioProject(identity.organisationId,portfolioId);
  return project?content({project}):{isError:true,content:[{type:"text" as const,text:"Project not found in this organisation."}]};
 });
 return server;
}
