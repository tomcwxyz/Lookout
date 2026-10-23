/** Explicit resource grants; no implicit cross-organisation or cross-project access. */
export type OrganisationRole = "owner"|"admin"|"member"|"viewer";
export type McpGrant = { scope: "portfolio:read"|"project:read"|"contribution:write"; portfolioProjectId: number|null };
export type ScopedPrincipal = { organisationId:number; userId:number; membershipRole:OrganisationRole; connectionRevoked:boolean; grants:McpGrant[] };
export function canAccessProject(principal:ScopedPrincipal,projectOrganisationId:number,projectId:number,action:"read"|"contribute"):boolean {
 if(principal.connectionRevoked || principal.organisationId!==projectOrganisationId || !Number.isSafeInteger(projectId) || projectId<1) return false;
 if(action==="read") return principal.grants.some(g=>(g.scope==="portfolio:read" && g.portfolioProjectId===null) || (g.scope==="project:read"&&g.portfolioProjectId===projectId));
 return principal.membershipRole!=="viewer" && principal.grants.some(g=>g.scope==="contribution:write" && g.portfolioProjectId===projectId);
}
