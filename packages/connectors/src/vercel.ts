import type { InfrastructureResource, SourceAdapter } from "@lookout/core";
import { normaliseGitRepo } from "@lookout/core";
import { ReadOnlyProviderClient } from "./http";

type VercelProject = {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
  link?: { type?: string; repo?: string; repoId?: number; org?: string; repoName?: string };
};
type VercelDeployment = {
  uid: string; name: string; url?: string | null; created?: number;
  readyState?: string; state?: string; target?: string | null;
  meta?: { githubCommitSha?: string; githubCommitRef?: string; githubRepo?: string; githubOrg?: string; githubRepoName?: string };
};
type ProjectPage = { projects: VercelProject[]; pagination?: { next?: number | null } };
type DeploymentPage = { deployments: VercelDeployment[]; pagination?: { next?: number | null } };

export type VercelAdapterOptions = {
  token: string; teamId?: string; maxProjects?: number; fetchImpl?: typeof fetch;
};

function dateFromMs(ms?: number): string | null {
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export class VercelAdapter implements SourceAdapter<InfrastructureResource> {
  name = "vercel";
  private readonly client: ReadOnlyProviderClient;
  private readonly options: VercelAdapterOptions;
  constructor(options: VercelAdapterOptions) {
    this.options = options;
    this.client = new ReadOnlyProviderClient("https://api.vercel.com", options.token, options.fetchImpl);
  }

  async discover(): Promise<InfrastructureResource[]> {
    const max = Math.min(100, Math.max(1, this.options.maxProjects ?? 30));
    const projects: VercelProject[] = [];
    let until: number | undefined;
    const seen = new Set<number>();
    do {
      const response = await this.client.get<ProjectPage>("/v9/projects", {
        teamId: this.options.teamId, limit: Math.min(100, max - projects.length), until
      });
      projects.push(...response.projects);
      const next = response.pagination?.next ?? undefined;
      if (!next || seen.has(next) || !response.projects.length) break;
      seen.add(next); until = next;
    } while (projects.length < max);

    const observedAt = new Date().toISOString();
    const output: InfrastructureResource[] = [];
    for (const project of projects.slice(0, max)) {
      const projectKey = "vercel:project:" + project.id;
      const git = project.link;
      // Verified repository identity only; no guessing from project display name.
      const gitRepository = git?.type === "github"
        ? normaliseGitRepo(git.repo ?? (git.org && git.repoName ? git.org + "/" + git.repoName : null))
        : null;
      const projectUrl = "https://vercel.com/dashboard/project/" + encodeURIComponent(project.name);
      output.push({
        key: projectKey, provider: "vercel", kind: "vercel_project", name: project.name,
        url: projectUrl, parentKey: null, gitRepository, isDefault: false,
        createdAt: dateFromMs(project.createdAt), updatedAt: dateFromMs(project.updatedAt),
        status: null, endpointCount: null,
        details: { projectId: project.id, gitProvider: git?.type ?? "unknown" }, observedAt
      });
      const response = await this.client.get<DeploymentPage>("/v6/deployments", {
        teamId: this.options.teamId, projectId: project.id, limit: 20
      });
      // Only retain the newest deployment per target; old failed builds must not be
      // represented as the current state after a succeeding deployment.
      const latest = new Map<string, VercelDeployment>();
      for (const deployment of response.deployments.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))) {
        const target = deployment.target === "production" ? "production" : deployment.target ?? "preview";
        if (!latest.has(target)) latest.set(target, deployment);
      }
      for (const [target, deployment] of latest) {
        output.push({
          key: "vercel:deployment:" + deployment.uid,
          provider: "vercel", kind: "vercel_deployment", name: deployment.name,
          url: deployment.url ? "https://" + deployment.url : projectUrl,
          parentKey: projectKey, gitRepository,
          isDefault: target === "production",
          createdAt: dateFromMs(deployment.created), updatedAt: dateFromMs(deployment.created),
          status: deployment.readyState ?? deployment.state ?? null, endpointCount: null,
          details: {
            projectId: project.id, deploymentId: deployment.uid, target,
            commitSha: deployment.meta?.githubCommitSha ?? null,
            gitBranch: deployment.meta?.githubCommitRef ?? null
          },
          observedAt
        });
      }
    }
    return output;
  }
}
