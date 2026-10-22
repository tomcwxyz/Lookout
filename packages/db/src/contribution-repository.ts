import { createHash } from "node:crypto";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { checkpointNextStep, parseContribution, type ContributionKind } from "@lookout/core";
import { getDatabase } from "./client";
import { agentAccessTokens, projects } from "./schema";
import { portfolioRepositoryLinks, portfolioProjects } from "./portfolio-schema";
import { agentContributions } from "./contribution-schema";

export class ContributionConflictError extends Error {
  constructor() { super("This contribution event ID already exists with different content"); }
}
export class ContributionRateLimitError extends Error {
  constructor() { super("Agent contribution daily limit reached"); }
}
export class ContributionScopeError extends Error {
  constructor() { super("Agent token is not authorised for a linked logical project"); }
}

/** Map a repository observation to the logical project it currently belongs to. */
export async function getPortfolioIdForObservedProject(observedProjectId: number): Promise<number | null> {
  const [row] = await getDatabase().select({ portfolioId: portfolioRepositoryLinks.portfolioProjectId })
    .from(projects).innerJoin(portfolioRepositoryLinks,
      eq(projects.providerId, portfolioRepositoryLinks.repositoryProviderId))
    .where(eq(projects.id, observedProjectId)).limit(1);
  return row?.portfolioId ?? null;
}

/** Agent writes are append-only, project scoped and idempotent; no human state is modified. */
export async function submitAgentContribution(observedProjectId: number, tokenId: number, input: unknown) {
  const contribution = parseContribution(input);
  const serialised = JSON.stringify(contribution);
  // Avoid collecting common credential formats in agent-written project memory.
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\\/\\/[^\\s]+@|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{30,})/i.test(serialised))
    throw new Error("Contribution appears to contain a credential");
  const hash = createHash("sha256").update(serialised).digest("hex");
  const db = getDatabase();
  return db.transaction(async tx => {
    const [token] = await tx.select({ id: agentAccessTokens.id })
      .from(agentAccessTokens).where(and(
        eq(agentAccessTokens.id, tokenId), eq(agentAccessTokens.projectId, observedProjectId),
        isNull(agentAccessTokens.revokedAt)
      )).limit(1);
    if (!token) throw new ContributionScopeError();
    const [link] = await tx.select({ portfolioId: portfolioRepositoryLinks.portfolioProjectId })
      .from(projects).innerJoin(portfolioRepositoryLinks,
        eq(projects.providerId, portfolioRepositoryLinks.repositoryProviderId))
      .where(eq(projects.id, observedProjectId)).limit(1);
    if (!link) throw new ContributionScopeError();
    const [existing] = await tx.select({ id: agentContributions.id, payloadHash: agentContributions.payloadHash })
      .from(agentContributions).where(and(eq(agentContributions.portfolioProjectId, link.portfolioId),
        eq(agentContributions.eventId, contribution.checkpoint.eventId))).limit(1);
    if (existing) {
      if (existing.payloadHash !== hash) throw new ContributionConflictError();
      return { id: existing.id, portfolioProjectId: link.portfolioId,
        duplicate: true, status: "proposed" as const, trust: "agent_reported" as const };
    }
    const [usage] = await tx.select({ total: count() }).from(agentContributions)
      .where(and(eq(agentContributions.tokenId, tokenId),
        gte(agentContributions.recordedAt, new Date(Date.now() - 86400000))));
    if ((usage?.total ?? 0) >= 100) throw new ContributionRateLimitError();
    const [inserted] = await tx.insert(agentContributions).values({
      portfolioProjectId: link.portfolioId, observedProjectId, tokenId,
      eventId: contribution.checkpoint.eventId, kind: contribution.kind,
      agent: contribution.checkpoint.agent, title: contribution.checkpoint.title,
      payload: contribution.checkpoint, payloadHash: hash
    }).onConflictDoNothing({ target: [agentContributions.portfolioProjectId, agentContributions.eventId] })
      .returning({ id: agentContributions.id });
    if (inserted) return { id: inserted.id, portfolioProjectId: link.portfolioId,
      duplicate: false, status: "proposed" as const, trust: "agent_reported" as const };
    const [raced] = await tx.select({ id: agentContributions.id, payloadHash: agentContributions.payloadHash })
      .from(agentContributions).where(and(eq(agentContributions.portfolioProjectId, link.portfolioId),
        eq(agentContributions.eventId, contribution.checkpoint.eventId))).limit(1);
    if (!raced || raced.payloadHash !== hash) throw new ContributionConflictError();
    return { id: raced.id, portfolioProjectId: link.portfolioId,
      duplicate: true, status: "proposed" as const, trust: "agent_reported" as const };
  });
}

export async function listPortfolioContributions(portfolioId: number, limit = 30, observedProjectId?: number) {
  if (!Number.isSafeInteger(portfolioId) || portfolioId < 1) throw new Error("Invalid portfolio project");
  const size = Math.min(Math.max(1, limit), 60);
  const rows = await getDatabase().select({
    id: agentContributions.id, kind: agentContributions.kind,
    observedProjectId: agentContributions.observedProjectId, eventId: agentContributions.eventId,
    agent: agentContributions.agent, title: agentContributions.title, payload: agentContributions.payload,
    recordedAt: agentContributions.recordedAt, status: agentContributions.status,
    tokenLabel: agentAccessTokens.label, repository: projects.slug
  }).from(agentContributions)
    .innerJoin(agentAccessTokens, eq(agentContributions.tokenId, agentAccessTokens.id))
    .innerJoin(projects, eq(agentContributions.observedProjectId, projects.id))
    .where(and(eq(agentContributions.portfolioProjectId, portfolioId),
      ...(observedProjectId ? [eq(agentContributions.observedProjectId, observedProjectId)] : [])))
    .orderBy(desc(agentContributions.recordedAt), desc(agentContributions.id)).limit(size);
  return rows.map(r => ({
    ...r, trust: "agent_reported" as const, nextStep: checkpointNextStep(r.payload)
  }));
}

export async function getPortfolioContributionHandover(observedProjectId: number) {
  const portfolioId = await getPortfolioIdForObservedProject(observedProjectId);
  if (!portfolioId) return null;
  const [project, contributions] = await Promise.all([
    getDatabase().select({ id: portfolioProjects.id, name: portfolioProjects.name,
      status: portfolioProjects.status, statusNote: portfolioProjects.statusNote,
      statusConfirmedAt: portfolioProjects.statusConfirmedAt })
      .from(portfolioProjects).where(eq(portfolioProjects.id, portfolioId)).limit(1),
    listPortfolioContributions(portfolioId, 20, observedProjectId)
  ]);
  return { project: project[0] ?? null, contributions,
    trustNote: "Agent statements are self-reported proposals; status is human-confirmed and never overwritten." };
}
