import { and, desc, eq } from "drizzle-orm";
import type { InfrastructureFinding, InfrastructureProvider, InfrastructureResource } from "@lookout/core";
import { getDatabase } from "./client";
import { projects } from "./schema";
import { infrastructureResources, infrastructureFindings, sourceSyncRuns } from "./infrastructure-schema";

/** Exact provider-supplied Git identity or explicit user confirmation: never match on a display name. */
export async function saveInfrastructureObservation(provider: InfrastructureProvider, resources: InfrastructureResource[], findings: InfrastructureFinding[]): Promise<number> {
  if (resources.some(r => r.provider !== provider)) throw new Error("Mixed provider batch");
  const keys = new Set(resources.map(r => r.key));
  if (keys.size !== resources.length || findings.some(f => !keys.has(f.resourceKey))) throw new Error("Invalid observation batch");
  const db = getDatabase();
  return db.transaction(async tx => {
    const gitProjects = await tx.select({ id: projects.id, slug: projects.slug }).from(projects);
    const exactRepos = new Map(gitProjects.map(g => [g.slug.toLowerCase(), g.id]));
    let count = 0;
    for (const resource of resources) {
      const [old] = await tx.select({
        projectId: infrastructureResources.projectId, linkMethod: infrastructureResources.linkMethod
      }).from(infrastructureResources).where(eq(infrastructureResources.key, resource.key)).limit(1);
      let projectId: number | null = null;
      let linkMethod: string | null = null;
      if (old?.linkMethod === "manual" || old?.linkMethod === "manual_excluded") {
        projectId = old.projectId;
        linkMethod = old.linkMethod;
      } else {
        const [parent] = resource.parentKey
          ? await tx.select({ projectId: infrastructureResources.projectId, linkMethod: infrastructureResources.linkMethod })
              .from(infrastructureResources).where(eq(infrastructureResources.key, resource.parentKey)).limit(1)
          : [];
        if (parent?.linkMethod === "manual_excluded" || parent?.linkMethod === "inherited_excluded") {
          linkMethod = "inherited_excluded";
        } else if (parent?.projectId) {
          projectId = parent.projectId;
          linkMethod = "inherited";
        } else if (resource.gitRepository && exactRepos.has(resource.gitRepository.toLowerCase())) {
          projectId = exactRepos.get(resource.gitRepository.toLowerCase())!;
          linkMethod = "verified_git";
        }
      }
      const [row] = await tx.insert(infrastructureResources).values({
        key: resource.key, provider: resource.provider, kind: resource.kind,
        name: resource.name, url: resource.url, parentKey: resource.parentKey,
        projectId, linkMethod, snapshot: resource, observedAt: new Date(resource.observedAt)
      }).onConflictDoUpdate({
        target: infrastructureResources.key,
        set: { provider: resource.provider, kind: resource.kind, name: resource.name,
          url: resource.url, parentKey: resource.parentKey, projectId, linkMethod,
          snapshot: resource, observedAt: new Date(resource.observedAt), updatedAt: new Date() }
      }).returning({ id: infrastructureResources.id });
      // Only resolve findings for a resource successfully scanned in this run.
      await tx.update(infrastructureFindings).set({ status: "resolved" })
        .where(and(eq(infrastructureFindings.resourceId, row!.id), eq(infrastructureFindings.status, "open")));
      for (const finding of findings.filter(f => f.resourceKey === resource.key)) {
        await tx.insert(infrastructureFindings).values({
          resourceId: row!.id, key: finding.key, kind: finding.kind, severity: finding.severity,
          title: finding.title, explanation: finding.explanation, evidenceUrl: finding.evidenceUrl,
          observedAt: new Date(finding.observedAt), status: "open"
        }).onConflictDoUpdate({
          target: [infrastructureFindings.resourceId, infrastructureFindings.key],
          set: { kind: finding.kind, severity: finding.severity, title: finding.title,
            explanation: finding.explanation, evidenceUrl: finding.evidenceUrl,
            observedAt: new Date(finding.observedAt), status: "open" }
        });
      }
      count++;
    }
    return count;
  });
}

export async function beginSourceSync(provider: InfrastructureProvider) {
  const [row] = await getDatabase().insert(sourceSyncRuns).values({ provider, status: "running" })
    .returning({ id: sourceSyncRuns.id });
  return row!.id;
}
export async function completeSourceSync(id: number, status: "completed" | "failed", count: number, error?: string) {
  await getDatabase().update(sourceSyncRuns).set({
    status, count, error: error?.slice(0, 1000) ?? null, finishedAt: new Date()
  }).where(eq(sourceSyncRuns.id, id));
}
export async function getInfrastructurePortfolio() {
  const db = getDatabase();
  const [resources, findings, syncs, projectRows] = await Promise.all([
    db.select().from(infrastructureResources).orderBy(desc(infrastructureResources.observedAt)),
    db.select().from(infrastructureFindings).where(eq(infrastructureFindings.status, "open")),
    db.select().from(sourceSyncRuns).orderBy(desc(sourceSyncRuns.startedAt)).limit(30),
    db.select({ id: projects.id, name: projects.name, slug: projects.slug }).from(projects)
  ]);
  const projectsById = new Map(projectRows.map(p => [p.id, p]));
  return {
    resources: resources.map(r => ({ ...r, project: r.projectId ? projectsById.get(r.projectId) ?? null : null })),
    findings, syncs: ["neon", "vercel"].map(provider => syncs.find(s => s.provider === provider) ?? null),
    projects: projectRows
  };
}
export async function getLinkedResources(projectId: number) {
  return getDatabase().select().from(infrastructureResources)
    .where(eq(infrastructureResources.projectId, projectId))
    .orderBy(desc(infrastructureResources.observedAt));
}
export async function setInfrastructureProjectLink(key: string, projectId: number | null) {
  const db = getDatabase();
  return db.transaction(async tx => {
    if (projectId !== null) {
      const [project] = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) throw new Error("Project not found");
    }
    const [resource] = await tx.update(infrastructureResources).set({
      projectId, linkMethod: projectId === null ? "manual_excluded" : "manual", updatedAt: new Date()
    }).where(eq(infrastructureResources.key, key)).returning({ id: infrastructureResources.id });
    if (!resource) throw new Error("Resource not found");
    const children = await tx.select({ id: infrastructureResources.id, method: infrastructureResources.linkMethod })
      .from(infrastructureResources).where(eq(infrastructureResources.parentKey, key));
    for (const child of children) {
      if (child.method === "manual" || child.method === "manual_excluded") continue;
      await tx.update(infrastructureResources).set({
        projectId, linkMethod: projectId === null ? "inherited_excluded" : "inherited", updatedAt: new Date()
      }).where(eq(infrastructureResources.id, child.id));
    }
  });
}
