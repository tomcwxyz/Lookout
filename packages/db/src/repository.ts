import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { ProjectAssessment } from "@lookout/core";
import { getDatabase } from "./client";
import { projects, attentionItems, syncRuns, ideas, workDecisions } from "./schema";

export function stableSnapshotHash(assessment: ProjectAssessment): string {
  const { observedAt: _observedAt, ...snapshot } = assessment.snapshot;
  return createHash("sha256").update(JSON.stringify({ snapshot, findings: assessment.findings.map(f => f.key) })).digest("hex");
}

export async function saveAssessment(assessment: ProjectAssessment, aiBrief?: string | null) {
  const db = getDatabase();
  const hash = stableSnapshotHash(assessment);
  return db.transaction(async tx => {
    const previous = await tx.select({ id: projects.id, snapshotHash: projects.snapshotHash, aiBrief: projects.aiBrief })
      .from(projects).where(eq(projects.providerId, assessment.snapshot.providerId)).limit(1);
    const changed = previous[0]?.snapshotHash !== hash;
    const rows = await tx.insert(projects).values({
      providerId: assessment.snapshot.providerId,
      slug: assessment.snapshot.slug,
      name: assessment.snapshot.name,
      url: assessment.snapshot.url,
      description: assessment.snapshot.description,
      snapshot: assessment.snapshot,
      snapshotHash: hash,
      ruleSummary: assessment.summary,
      aiBrief: changed ? (aiBrief ?? null) : (previous[0]?.aiBrief ?? null),
      observedAt: new Date(assessment.snapshot.observedAt)
    }).onConflictDoUpdate({
      target: projects.providerId,
      set: {
        slug: assessment.snapshot.slug,
        name: assessment.snapshot.name,
        url: assessment.snapshot.url,
        description: assessment.snapshot.description,
        snapshot: assessment.snapshot,
        snapshotHash: hash,
        ruleSummary: assessment.summary,
        aiBrief: changed ? (aiBrief ?? null) : (previous[0]?.aiBrief ?? null),
        observedAt: new Date(assessment.snapshot.observedAt),
        updatedAt: new Date()
      }
    }).returning({ id: projects.id });

    const projectId = rows[0]!.id;
    // Resolution is scoped to this successfully inspected project. Never resolve findings for a failed scan.
    await tx.update(attentionItems).set({ status: "resolved" })
      .where(and(eq(attentionItems.projectId, projectId), eq(attentionItems.status, "open")));

    for (const finding of assessment.findings) {
      await tx.insert(attentionItems).values({
        projectId, key: finding.key, kind: finding.kind, severity: finding.severity,
        title: finding.title, explanation: finding.explanation, evidenceUrl: finding.evidenceUrl,
        status: "open", observedAt: new Date(finding.observedAt)
      }).onConflictDoUpdate({
        target: [attentionItems.projectId, attentionItems.key],
        set: {
          kind: finding.kind, severity: finding.severity, title: finding.title,
          explanation: finding.explanation, evidenceUrl: finding.evidenceUrl,
          status: "open", observedAt: new Date(finding.observedAt)
        }
      });
    }
    return { projectId, changed };
  });
}

export async function lookupHash(providerId: string) {
  const rows = await getDatabase().select({ hash: projects.snapshotHash, aiBrief: projects.aiBrief })
    .from(projects).where(eq(projects.providerId, providerId)).limit(1);
  return rows[0] ?? null;
}

export async function createSyncRun() {
  const rows = await getDatabase().insert(syncRuns).values({ status: "running" }).returning({ id: syncRuns.id });
  return rows[0]!.id;
}

export async function finishSyncRun(id: number, status: "completed" | "failed", projectCount: number, error?: string) {
  await getDatabase().update(syncRuns).set({ status, projectCount, finishedAt: new Date(), error: error ?? null })
    .where(eq(syncRuns.id, id));
}

export async function getPortfolio() {
  const db = getDatabase();
  const [allProjects, activeItems, runs, decisions] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.observedAt)),
    db.select({ id: attentionItems.id, projectId: attentionItems.projectId, key: attentionItems.key,
      kind: attentionItems.kind, severity: attentionItems.severity, title: attentionItems.title,
      explanation: attentionItems.explanation, evidenceUrl: attentionItems.evidenceUrl,
      observedAt: attentionItems.observedAt, slug: projects.slug, name: projects.name })
      .from(attentionItems).innerJoin(projects, eq(attentionItems.projectId, projects.id))
      .where(eq(attentionItems.status, "open")).orderBy(desc(attentionItems.observedAt)),
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1),
    db.select().from(workDecisions)
  ]);
  return { projects: allProjects, attention: activeItems, latestRun: runs[0] ?? null, workDecisions: decisions };
}

export async function getProject(id: number) {
  const db = getDatabase();
  const [matches, findings, projectIdeas, decisions] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)).limit(1),
    db.select().from(attentionItems).where(and(eq(attentionItems.projectId, id), eq(attentionItems.status, "open"))),
    db.select().from(ideas).where(eq(ideas.projectId, id)).orderBy(desc(ideas.createdAt)),
    db.select().from(workDecisions).where(eq(workDecisions.projectId, id))
  ]);
  return { project: matches[0] ?? null, findings, ideas: projectIdeas, decisions };
}

export async function saveIdea(input: { projectId?: number; title: string; note?: string }) {
  const title = input.title.trim();
  if (!title || title.length > 240) throw new Error("Title must be 1 to 240 characters");
  return getDatabase().insert(ideas).values({
    projectId: input.projectId ?? null, title, note: input.note?.slice(0, 5000) ?? null
  }).returning();
}

export const acceptedWorkStatuses = [
  "complete", "needs_tidy", "needs_testing", "needs_review",
  "in_progress", "on_hold", "scoped_not_built"
] as const;
export type AcceptedWorkStatus = typeof acceptedWorkStatuses[number];

/** User-authored decisions are never overwritten by observation sync. */
export async function saveWorkDecision(
  projectId: number, workKey: string, status: AcceptedWorkStatus | null, note: string
) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new Error("Invalid project");
  if (workKey.length < 1 || workKey.length > 300) throw new Error("Invalid work key");
  const db = getDatabase();
  if (status === null) {
    await db.delete(workDecisions).where(and(eq(workDecisions.projectId, projectId), eq(workDecisions.workKey, workKey)));
    return;
  }
  await db.insert(workDecisions).values({ projectId, workKey, status, note: note.slice(0, 500), updatedAt: new Date() })
    .onConflictDoUpdate({ target: [workDecisions.projectId, workDecisions.workKey],
      set: { status, note: note.slice(0, 500), updatedAt: new Date() } });
}
