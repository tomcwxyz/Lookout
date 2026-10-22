import { and, eq, desc, inArray } from "drizzle-orm";
import { getDatabase } from "./client";
import { projects } from "./schema";
import { githubScanState, portfolioProjects, portfolioRepositoryLinks, repositoryInventory } from "./portfolio-schema";

export const confirmedProjectStatuses = ["exploring", "building", "testing", "live", "maintaining", "paused", "archived"] as const;
export type ConfirmedProjectStatus = typeof confirmedProjectStatuses[number];
export type DiscoveredRepository = {
  providerId: string; slug: string; name: string; url: string; description: string | null;
  visibility: "public" | "private" | "unknown"; archived: boolean; fork: boolean; lastActivityAt: string | null;
};

/** All accessible repositories are inventoried before any expensive per-repo inspection. */
export async function saveRepositoryInventory(repos: DiscoveredRepository[]) {
  const db = getDatabase();
  if (new Set(repos.map(r => r.providerId)).size !== repos.length) throw new Error("Duplicate repository identity");
  await db.transaction(async tx => {
    const knownLinks = await tx.select({ providerId: portfolioRepositoryLinks.repositoryProviderId })
      .from(portfolioRepositoryLinks);
    const linked = new Set(knownLinks.map(x => x.providerId));
    for (const repo of repos) {
      await tx.insert(repositoryInventory).values({
        ...repo, lastActivityAt: repo.lastActivityAt ? new Date(repo.lastActivityAt) : null,
        lastSeenAt: new Date()
      }).onConflictDoUpdate({ target: repositoryInventory.providerId, set: {
        slug: repo.slug, name: repo.name, url: repo.url, description: repo.description,
        visibility: repo.visibility, archived: repo.archived, fork: repo.fork,
        lastActivityAt: repo.lastActivityAt ? new Date(repo.lastActivityAt) : null, lastSeenAt: new Date()
      } });
      if (!linked.has(repo.providerId)) {
        const [created] = await tx.insert(portfolioProjects).values({ name: repo.name, description: repo.description })
          .returning({ id: portfolioProjects.id });
        await tx.insert(portfolioRepositoryLinks).values({
          repositoryProviderId: repo.providerId, portfolioProjectId: created!.id
        }).onConflictDoNothing();
        linked.add(repo.providerId);
      }
    }
    await tx.insert(githubScanState).values({ id: 1, inventoryCount: repos.length, lastInventoryAt: new Date() })
      .onConflictDoUpdate({ target: githubScanState.id, set: {
        inventoryCount: repos.length, lastInventoryAt: new Date(), updatedAt: new Date()
      } });
  });
}

/** Offset only advances after a batch completes, so a failed function invocation can retry. */
export async function getGithubScanOffset() {
  const [row] = await getDatabase().select({ offset: githubScanState.nextOffset })
    .from(githubScanState).where(eq(githubScanState.id, 1)).limit(1);
  return row?.offset ?? 0;
}
export async function advanceGithubScanOffset(nextOffset: number) {
  await getDatabase().update(githubScanState).set({ nextOffset, updatedAt: new Date() })
    .where(eq(githubScanState.id, 1));
}
export async function markRepositoryInspected(providerId: string, error?: string) {
  await getDatabase().update(repositoryInventory).set({
    ...(error ? {} : { detailedAt: new Date() }),
    inspectionError: error?.slice(0, 500) ?? null
  }).where(eq(repositoryInventory.providerId, providerId));
}

/** A logical project may have zero, one or multiple GitHub repositories. */
export async function getLogicalPortfolio() {
  const db = getDatabase();
  const [logical, links, inventory, observed, scan] = await Promise.all([
    db.select().from(portfolioProjects).orderBy(desc(portfolioProjects.updatedAt)),
    db.select().from(portfolioRepositoryLinks),
    db.select().from(repositoryInventory),
    db.select({ id: projects.id, providerId: projects.providerId, observedAt: projects.observedAt })
      .from(projects),
    db.select().from(githubScanState).where(eq(githubScanState.id, 1)).limit(1)
  ]);
  const reposById = new Map(inventory.map(r => [r.providerId, r]));
  const observedById = new Map(observed.map(r => [r.providerId, r]));
  const repositoriesByProject = new Map<number, typeof inventory>();
  for (const link of links) {
    const repo = reposById.get(link.repositoryProviderId);
    if (!repo) continue;
    const entry = { ...repo, repositoryObservationId: observedById.get(repo.providerId)?.id ?? null,
      observedAt: observedById.get(repo.providerId)?.observedAt ?? null };
    const list = repositoriesByProject.get(link.portfolioProjectId) ?? [];
    // Type of the list is widened to include observation identifiers below.
    list.push(entry);
    repositoriesByProject.set(link.portfolioProjectId, list);
  }
  const projectRows = logical.map(p => ({
    ...p, repositories: (repositoriesByProject.get(p.id) ?? []).map(r => ({
      ...r, repositoryObservationId: observedById.get(r.providerId)?.id ?? null,
      observedAt: observedById.get(r.providerId)?.observedAt ?? null
    }))
  }));
  return {
    projects: projectRows,
    coverage: {
      accessibleRepositories: scan[0]?.inventoryCount ?? inventory.length,
      inventoriedRepositories: inventory.length,
      detailedRepositories: inventory.filter(r => r.detailedAt !== null).length,
      privateRepositories: inventory.filter(r => r.visibility === "private").length,
      inspectionFailures: inventory.filter(r => r.inspectionError !== null).length,
      lastInventoryAt: scan[0]?.lastInventoryAt ?? null,
      nextOffset: scan[0]?.nextOffset ?? 0,
      note: "Counts include only repositories visible to Lookout's configured GitHub token. An unobserved repository is not confirmed absent."
    }
  };
}
export async function getLogicalProject(id: number) {
  const data = await getLogicalPortfolio();
  return data.projects.find(p => p.id === id) ?? null;
}
export async function createLogicalProject(name: string, description?: string) {
  if (!name.trim() || name.trim().length > 120 || (description?.length ?? 0) > 2000) throw new Error("Invalid project details");
  const [row] = await getDatabase().insert(portfolioProjects).values({
    name: name.trim(), description: description?.trim() || null
  }).returning({ id: portfolioProjects.id });
  return row!.id;
}
export async function confirmLogicalProject(id: number, status: ConfirmedProjectStatus | null, note: string) {
  if (!Number.isSafeInteger(id) || id <= 0 || note.length > 2000
    || (status !== null && !confirmedProjectStatuses.includes(status))) throw new Error("Invalid project update");
  const [row] = await getDatabase().update(portfolioProjects).set({
    status, statusNote: note.trim() || null, statusConfirmedAt: status ? new Date() : null,
    updatedAt: new Date()
  }).where(eq(portfolioProjects.id, id)).returning({ id: portfolioProjects.id });
  if (!row) throw new Error("Project not found");
}
export async function assignRepositoryToProject(providerId: string, portfolioId: number) {
  if (!Number.isSafeInteger(portfolioId) || portfolioId <= 0 || !providerId || providerId.length > 100)
    throw new Error("Invalid association");
  const db = getDatabase();
  await db.transaction(async tx => {
    const [repo] = await tx.select({ id: repositoryInventory.providerId }).from(repositoryInventory)
      .where(eq(repositoryInventory.providerId, providerId)).limit(1);
    const [project] = await tx.select({ id: portfolioProjects.id }).from(portfolioProjects)
      .where(eq(portfolioProjects.id, portfolioId)).limit(1);
    if (!repo || !project) throw new Error("Unknown repository or project");
    await tx.insert(portfolioRepositoryLinks).values({
      repositoryProviderId: providerId, portfolioProjectId: portfolioId
    }).onConflictDoUpdate({ target: portfolioRepositoryLinks.repositoryProviderId,
      set: { portfolioProjectId: portfolioId, linkedAt: new Date() } });
  });
}
