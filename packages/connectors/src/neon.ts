import type { InfrastructureResource, SourceAdapter } from "@lookout/core";
import { ReadOnlyProviderClient } from "./http";

type NeonProject = { id: string; name: string; default_branch_id?: string | null; created_at?: string; updated_at?: string };
type NeonBranch = { id: string; name: string; parent_id?: string | null; created_at?: string; updated_at?: string; primary?: boolean; protected?: boolean };
type NeonEndpoint = { id: string; branch_id: string; current_state?: string; type?: string };
type Paginated<T> = { pagination?: { cursor?: string | null; next?: string | null } } & T;

export type NeonAdapterOptions = {
  token: string;
  orgId?: string;
  maxProjects?: number;
  maxBranchesPerProject?: number;
  fetchImpl?: typeof fetch;
};

export class NeonAdapter implements SourceAdapter<InfrastructureResource> {
  name = "neon";
  private readonly client: ReadOnlyProviderClient;
  private readonly options: NeonAdapterOptions;

  constructor(options: NeonAdapterOptions) {
    this.options = options;
    this.client = new ReadOnlyProviderClient("https://console.neon.tech", options.token, options.fetchImpl);
  }

  async discover(): Promise<InfrastructureResource[]> {
    const projects: NeonProject[] = [];
    const max = Math.min(100, Math.max(1, this.options.maxProjects ?? 30));
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const batch = await this.client.get<Paginated<{ projects: NeonProject[]; unavailable?: unknown[] }>>(
        "/api/v2/projects", { limit: Math.min(100, max - projects.length), cursor, org_id: this.options.orgId }
      );
      if (batch.unavailable?.length) throw new Error("Neon returned incomplete project listing; retry rather than treating missing projects as removed");
      projects.push(...batch.projects);
      const next = batch.pagination?.cursor ?? undefined;
      if (!next || seen.has(next) || !batch.projects.length) break;
      seen.add(next);
      cursor = next;
    } while (projects.length < max);

    const results: InfrastructureResource[] = [];
    const observedAt = new Date().toISOString();
    for (const project of projects.slice(0, max)) {
      const prefix = "/api/v2/projects/" + encodeURIComponent(project.id);
      const branches: NeonBranch[] = [];
      let branchCursor: string | undefined;
      const branchSeen = new Set<string>();
      const maxBranches = Math.min(1000, Math.max(1, this.options.maxBranchesPerProject ?? 100));
      do {
        const response = await this.client.get<Paginated<{ branches: NeonBranch[] }>>(
          prefix + "/branches", { limit: Math.min(100, maxBranches - branches.length), cursor: branchCursor }
        );
        branches.push(...response.branches);
        const next = response.pagination?.next ?? response.pagination?.cursor ?? undefined;
        if (!next || branchSeen.has(next) || !response.branches.length) break;
        branchSeen.add(next); branchCursor = next;
      } while (branches.length < maxBranches);
      const computes = await this.client.get<{ endpoints: NeonEndpoint[] }>(prefix + "/endpoints");
      const projectKey = "neon:project:" + project.id;
      const projectUrl = "https://console.neon.tech/app/projects/" + encodeURIComponent(project.id);
      results.push({
        key: projectKey, provider: "neon", kind: "neon_project", name: project.name,
        url: projectUrl, parentKey: null, gitRepository: null, isDefault: false,
        createdAt: project.created_at ?? null, updatedAt: project.updated_at ?? null,
        status: null, endpointCount: computes.endpoints.length,
        details: { projectId: project.id, branchCount: branches.length }, observedAt
      });
      for (const branch of branches.slice(0, maxBranches)) {
        const endpoints = computes.endpoints.filter(e => e.branch_id === branch.id);
        results.push({
          key: "neon:branch:" + project.id + ":" + branch.id,
          provider: "neon", kind: "neon_branch",
          name: branch.name, url: projectUrl + "/branches/" + encodeURIComponent(branch.id),
          parentKey: projectKey, gitRepository: null,
          isDefault: branch.id === project.default_branch_id || branch.primary === true || (!branch.parent_id && !project.default_branch_id),
          createdAt: branch.created_at ?? null, updatedAt: branch.updated_at ?? null,
          status: endpoints.length ? (endpoints.map(e => e.current_state ?? "unknown").join(", ")) : "no compute endpoint",
          endpointCount: endpoints.length,
          details: {
            projectId: project.id, branchId: branch.id, parentBranchId: branch.parent_id ?? null,
            protected: branch.protected ?? false
          },
          observedAt
        });
      }
    }
    return results;
  }
}
