import {
 getPortfolio, getLogicalPortfolio, getInfrastructurePortfolio,
 listTenantPortfolioProjects
} from "@lookout/db";

/** Scoped adapters supply Lookout's EXISTING page components with organisation-owned data.
 * These do not change the legacy single-owner schema or the page design.
 * No raw global read result is returned to the browser.
 */
export async function getAccountLogicalPortfolio(organisationId: number) {
 const [raw, grants] = await Promise.all([
   getLogicalPortfolio(),listTenantPortfolioProjects(organisationId)
 ]);
 const allowed=new Set(grants.map(p=>p.id));
 const projects=raw.projects.filter(p=>allowed.has(p.id));
 const repositories=new Map(projects.flatMap(p=>p.repositories.map(repo=>[repo.providerId,repo] as const)));
 const inventory=[...repositories.values()];
 return {
  projects,
  coverage:{
   ...raw.coverage,
   accessibleRepositories:inventory.length,
   inventoriedRepositories:inventory.length,
   detailedRepositories:inventory.filter(r=>r.detailedAt!=null).length,
   privateRepositories:inventory.filter(r=>r.visibility==="private").length,
   inspectionFailures:inventory.filter(r=>r.inspectionError!=null).length,
   lastInventoryAt:null,
   nextOffset:0,
   note:"Only repositories explicitly assigned to this organisation are included."
  }
 };
}

export async function getAccountObservedPortfolio(organisationId:number) {
 const [raw,logical]=await Promise.all([getPortfolio(),getAccountLogicalPortfolio(organisationId)]);
 const permittedIds=new Set(logical.projects.flatMap(p=>p.repositories.map(r=>r.repositoryObservationId).filter((id):id is number=>id!==null)));
 return {
  projects:raw.projects.filter(p=>permittedIds.has(p.id)),
  attention:raw.attention.filter(item=>permittedIds.has(item.projectId)),
  workDecisions:raw.workDecisions.filter(d=>permittedIds.has(d.projectId)),
  latestRun:null
 };
}

export async function getAccountInfrastructure(organisationId:number) {
 const [raw,logical]=await Promise.all([getInfrastructurePortfolio(),getAccountLogicalPortfolio(organisationId)]);
 const allowedKeys=new Set(logical.projects.flatMap(p=>p.infrastructure.map(resource=>resource.key)));
 const allowedObservedIds=new Set(logical.projects.flatMap(p=>p.repositories.map(r=>r.repositoryObservationId).filter((id):id is number=>id!==null)));
 const resources=raw.resources.filter(r=>allowedKeys.has(r.key));
 const resourceIds=new Set(resources.map(r=>r.id));
 return {
  ...raw,
  resources,
  findings:raw.findings.filter(f=>resourceIds.has(f.resourceId)),
  projects:raw.projects.filter(p=>allowedObservedIds.has(p.id)),
  syncs:[null,null] as typeof raw.syncs
 };
}
