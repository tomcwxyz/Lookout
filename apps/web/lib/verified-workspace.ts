import { resolveOrganisationMember, authorisedPortfolioProject, listTenantPortfolioProjects } from "@lookout/db";

/** A server-side Neon Auth adapter must produce this identity after validating its session.
 * Never construct it from a client-provided subject/email/header/organisation selector.
 */
export type VerifiedIdentity = { issuer: string; subject: string; authenticated: true };
export type VerifySession = () => Promise<VerifiedIdentity | null>;

export async function verifiedWorkspace(verify: VerifySession, organisationId: number) {
 if(!Number.isSafeInteger(organisationId) || organisationId < 1) return null;
 const identity = await verify();
 if(!identity?.authenticated || !identity.issuer.startsWith("https://") ||
     !identity.subject || identity.subject.length > 512) return null;
 const membership=await resolveOrganisationMember(identity.issuer,identity.subject,organisationId);
 return membership ? { ...membership, verifiedIdentity: identity } : null;
}

export async function verifiedProjectRead(verify: VerifySession,organisationId:number,projectId:number) {
 const workspace=await verifiedWorkspace(verify,organisationId);
 if(!workspace) return null;
 const project=await authorisedPortfolioProject(workspace.organisationId,projectId);
 return project ? {workspace,project}:null;
}

export async function verifiedWorkspaceProjects(verify:VerifySession,organisationId:number) {
 const workspace=await verifiedWorkspace(verify,organisationId);
 if(!workspace) return null;
 return {workspace,projects:await listTenantPortfolioProjects(organisationId)};
}
