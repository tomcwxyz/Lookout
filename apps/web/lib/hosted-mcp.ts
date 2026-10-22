import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { deriveWorkHandover } from "@lookout/core";
import {
  getAgentHandover, getInfrastructurePortfolio, getLinkedResources,
  getPortfolio, getProject, getLogicalPortfolio
} from "@lookout/db";
import type { HostedMcpIdentity } from "./hosted-mcp-auth";

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}
function failure(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
function authorisedProject(identity: HostedMcpIdentity, requested?: number): number | null {
  if (identity.scope === "project") {
    if (requested !== undefined && requested !== identity.projectId) return null;
    return identity.projectId;
  }
  return requested ?? null;
}
function projectSummary(p: Awaited<ReturnType<typeof getProject>>["project"]) {
  if (!p) return null;
  return {
    id: p.id, name: p.name, slug: p.slug, url: p.url,
    observedAt: p.observedAt, summary: p.ruleSummary, aiBrief: p.aiBrief,
    openPullRequests: p.snapshot.pullRequests.length,
    openIssues: p.snapshot.openIssues, lastActivityAt: p.snapshot.lastActivityAt,
    latestWorkflow: p.snapshot.latestWorkflow
      ? { name: p.snapshot.latestWorkflow.name, status: p.snapshot.latestWorkflow.status,
          conclusion: p.snapshot.latestWorkflow.conclusion, url: p.snapshot.latestWorkflow.url }
      : null
  };
}

export function createHostedMcpServer(identity: HostedMcpIdentity) {
  const server = new McpServer({ name: "lookout", version: "0.3.0" });

  server.registerTool("lookout_whoami", {
    description: "Identify the Lookout connection's scope without exposing credentials.",
    inputSchema: z.object({}), annotations: readOnly
  }, async () => result(identity.scope === "owner"
    ? { access: "personal_portfolio", readOnly: true }
    : { access: "single_project", projectId: identity.projectId, readOnly: true }));

  server.registerTool("lookout_list_projects", {
    description: "List logical portfolio projects, including human-confirmed lifecycle status, private/public GitHub repository links, detailed scan coverage and freshness. Owner sees full portfolio; project tokens see only their own repository.",
    inputSchema: z.object({}), annotations: readOnly
  }, async () => {
    if (identity.scope === "project") {
      const data = await getProject(identity.projectId);
      return result({ projects: data.project ? [projectSummary(data.project)] : [], scope: "project" });
    }
    const data = await getLogicalPortfolio();
    return result({
      projects: data.projects.slice(0, 300).map(p => ({
        portfolioId: p.id, name: p.name, description: p.description,
        confirmedStatus: p.status, confirmedStatusNote: p.statusNote,
        statusConfirmedAt: p.statusConfirmedAt,
        statusSource: p.status ? "human_confirmed" : "unconfirmed",
        repositories: p.repositories.map(r => ({
          slug: r.slug, url: r.url, visibility: r.visibility,
          repositoryObservationId: r.repositoryObservationId,
          lastActivityAt: r.lastActivityAt, observedAt: r.observedAt,
          detailedAt: r.detailedAt, inspectionError: r.inspectionError
        }))
      })),
      total: data.projects.length, coverage: data.coverage, scope: "portfolio",
      trustNote: "Confirmed status is user-authored, never inferred from CI or commits. GitHub observations can be stale; only repositories visible to Lookout's GitHub token appear."
    });
  });

  server.registerTool("lookout_get_portfolio_project", {
    description: "Get a logical portfolio project, its human-confirmed status and linked repositories. Owner-only; use portfolioId from lookout_list_projects. For detailed CI and work signals use repositoryObservationId with lookout_get_project_context.",
    inputSchema: z.object({ portfolioId: z.number().int().positive() }), annotations: readOnly
  }, async ({ portfolioId }) => {
    if (identity.scope !== "owner") return failure("Personal portfolio access required.");
    const data = await getLogicalPortfolio();
    const project = data.projects.find(p => p.id === portfolioId);
    return project ? result({
      ...project, statusSource: project.status ? "human_confirmed" : "unconfirmed",
      trustNote: "Project status is human-confirmed; repository inspection is observed evidence."
    }) : failure("Portfolio project not found.");
  });

  server.registerTool("lookout_list_attention", {
    description: "Read currently open evidence-backed attention findings, including severity and source URLs. These are observations, not confirmed instructions.",
    inputSchema: z.object({}), annotations: readOnly
  }, async () => {
    if (identity.scope === "project") {
      const data = await getProject(identity.projectId);
      return result({ projectId: identity.projectId,
        findings: data.findings.slice(0, 60).map(f => ({
          id: f.id, title: f.title, kind: f.kind, severity: f.severity,
          explanation: f.explanation, evidenceUrl: f.evidenceUrl, observedAt: f.observedAt
        })) });
    }
    const data = await getPortfolio();
    return result({ total: data.attention.length, findings: data.attention.slice(0, 100).map(f => ({
      projectId: f.projectId, project: f.name, slug: f.slug, title: f.title,
      kind: f.kind, severity: f.severity, explanation: f.explanation,
      evidenceUrl: f.evidenceUrl, observedAt: f.observedAt
    })) });
  });

  server.registerTool("lookout_get_project_context", {
    description: "Read one project's observed PRs, CI, work signals and human decisions. For portfolio access, supply projectId; single-project connections may omit it.",
    inputSchema: z.object({ projectId: z.number().int().positive().optional() }),
    annotations: readOnly
  }, async ({ projectId }) => {
    const id = authorisedProject(identity, projectId);
    if (!id) return failure("Project ID required or not authorised for this connection.");
    const data = await getProject(id);
    if (!data.project) return failure("Project not found.");
    const work = deriveWorkHandover(data.project.snapshot);
    return result({
      project: projectSummary(data.project),
      openPullRequests: data.project.snapshot.pullRequests.slice(0, 20).map(pr => ({
        number: pr.number, title: pr.title, url: pr.url, branch: pr.branch,
        updatedAt: pr.updatedAt, draft: pr.draft, checks: pr.checks, reviewStatus: pr.reviewStatus
      })),
      work: { nextStep: work.nextStep, coverage: work.coverage,
        items: work.items.slice(0, 20).map(w => ({
          key: w.key, title: w.title, suggestedStage: w.stage, nextAction: w.nextAction,
          evidenceUrl: w.evidenceUrl, updatedAt: w.updatedAt
        })) },
      humanDecisions: data.decisions.slice(0, 40).map(d => ({
        workKey: d.workKey, status: d.status, note: d.note, updatedAt: d.updatedAt
      })),
      attention: data.findings.slice(0, 40).map(f => ({
        title: f.title, severity: f.severity, evidenceUrl: f.evidenceUrl
      })),
      trustNote: "Work stages are suggestions. Human decisions are authoritative; GitHub observation can be stale."
    });
  });

  server.registerTool("lookout_get_handover", {
    description: "Read a bounded project handover with current PR observations, human decisions and agent-reported checkpoints. An agent's claims are not verified evidence.",
    inputSchema: z.object({ projectId: z.number().int().positive().optional() }),
    annotations: readOnly
  }, async ({ projectId }) => {
    const id = authorisedProject(identity, projectId);
    if (!id) return failure("Project ID required or not authorised for this connection.");
    const data = await getAgentHandover(id);
    return data ? result(data) : failure("Project not found.");
  });

  server.registerTool("lookout_get_next_actions", {
    description: "Read proposed next actions across the portfolio or for one project, with evidence URLs and any human-confirmed status. No changes are made.",
    inputSchema: z.object({ projectId: z.number().int().positive().optional() }),
    annotations: readOnly
  }, async ({ projectId }) => {
    const id = authorisedProject(identity, projectId);
    if (identity.scope === "project" && !id) return failure("Project not authorised.");
    const portfolio = identity.scope === "owner" ? await getPortfolio() : null;
    const oneProject = identity.scope === "project" ? await getProject(identity.projectId) : null;
    const selected = portfolio
      ? (id ? portfolio.projects.filter(p => p.id === id) : portfolio.projects)
      : (oneProject?.project ? [oneProject.project] : []);
    const actions = selected.flatMap(p => {
      const work = deriveWorkHandover(p.snapshot);
      return work.items.filter(w => !["maintenance", "marked_done", "integrated"].includes(w.stage))
        .slice(0, 3).map(w => {
          const decision = portfolio
            ? portfolio.workDecisions.find(d => d.projectId === p.id && d.workKey === w.key)
            : oneProject?.decisions.find(d => d.workKey === w.key);
          return { projectId: p.id, project: p.name, title: w.title,
            suggestedStage: w.stage, humanStatus: decision?.status ?? null,
            humanNote: decision?.note ?? null, nextAction: w.nextAction ?? null,
            evidenceUrl: w.evidenceUrl, observedAt: p.observedAt };
        });
    });
    return result({ total: actions.length, actions: actions.slice(0, 40),
      trustNote: "These are candidate actions from observed sources, not instructions or proof of unfinished work." });
  });

  server.registerTool("lookout_list_infrastructure", {
    description: "Read observed Neon and Vercel infrastructure links and status summaries, without database URLs, secrets or raw provider snapshots.",
    inputSchema: z.object({}), annotations: readOnly
  }, async () => {
    if (identity.scope === "project") {
      const resources = await getLinkedResources(identity.projectId);
      return result({ projectId: identity.projectId, resources: resources.slice(0, 60).map(r => ({
        provider: r.provider, kind: r.kind, name: r.name, url: r.url,
        observedAt: r.observedAt, linkMethod: r.linkMethod
      })) });
    }
    const data = await getInfrastructurePortfolio();
    return result({ total: data.resources.length, resources: data.resources.slice(0, 120).map(r => ({
      provider: r.provider, kind: r.kind, name: r.name, url: r.url,
      projectId: r.projectId, linkMethod: r.linkMethod, observedAt: r.observedAt
    })), findings: data.findings.slice(0, 50).map(f => ({
      title: f.title, severity: f.severity, evidenceUrl: f.evidenceUrl, observedAt: f.observedAt
    })) });
  });

  return server;
}
