import type { GitBranch, ProjectSnapshot, PullRequest, SourceAdapter, WorkflowRun } from "@lookout/core";

export type GitHubAdapterOptions = {
  token: string;
  owner?: string;
  maxRepos?: number;
  includeForks?: boolean;
  maxBranchesPerRepo?: number;
  fetchImpl?: typeof fetch;
};

type Repo = {
  id: number;
  full_name: string;
  name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  pushed_at: string | null;
  archived: boolean;
  fork: boolean;
};
type GHBranch = { name: string; commit: { sha: string } };
type GHPr = {
  number: number; title: string; html_url: string;
  head: { ref: string }; created_at: string; updated_at: string; draft: boolean
};
type GHIssue = { number: number; pull_request?: object };
type GHWorkflow = { workflow_runs: Array<{
  id: number; name: string; conclusion: string | null; status: string;
  html_url: string; created_at: string; head_branch: string
}> };
type GHCommit = { commit: { committer: { date: string | null } | null; author: { date: string | null } | null } };

export class GitHubAdapter implements SourceAdapter<ProjectSnapshot> {
  name = "github";
  private readonly token: string;
  private readonly owner?: string;
  private readonly maxRepos: number;
  private readonly includeForks: boolean;
  private readonly maxBranches: number;
  private readonly http: typeof fetch;

  constructor(options: GitHubAdapterOptions) {
    if (!options.token) throw new Error("GITHUB_TOKEN is required for read-only discovery");
    this.token = options.token;
    this.owner = options.owner;
    this.maxRepos = Math.min(500, Math.max(1, options.maxRepos ?? 25));
    this.includeForks = options.includeForks ?? false;
    this.maxBranches = Math.min(100, Math.max(1, options.maxBranchesPerRepo ?? 25));
    this.http = options.fetchImpl ?? fetch;
  }

  private async api<T>(path: string): Promise<T> {
    const response = await this.http("https://api.github.com" + path, {
      headers: {
        Authorization: "Bearer " + this.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "lookout-agent/0.1"
      }
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error("GitHub " + response.status + " " + path + ": " + detail);
    }
    return await response.json() as T;
  }

  private async listRepos(): Promise<Repo[]> {
    const repos: Repo[] = [];
    for (let page = 1; repos.length < this.maxRepos; page++) {
      const path = this.owner
        ? "/users/" + encodeURIComponent(this.owner) + "/repos?type=owner&sort=pushed&per_page=100&page=" + page
        : "/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=" + page;
      const batch = await this.api<Repo[]>(path);
      for (const repo of batch) {
        if (!repo.archived && (this.includeForks || !repo.fork)) repos.push(repo);
        if (repos.length === this.maxRepos) break;
      }
      if (batch.length < 100) break;
    }
    return repos;
  }

  async discover(): Promise<ProjectSnapshot[]> {
    const repos = await this.listRepos();
    const snapshots: ProjectSnapshot[] = [];
    for (const repo of repos) snapshots.push(await this.inspect(repo));
    return snapshots;
  }

  async inspect(repo: Repo): Promise<ProjectSnapshot> {
    const root = "/repos/" + repo.full_name.split("/").map(encodeURIComponent).join("/");
    const [branches, prs, issues, workflows] = await Promise.all([
      this.api<GHBranch[]>(root + "/branches?per_page=100"),
      this.api<GHPr[]>(root + "/pulls?state=open&per_page=100"),
      this.api<GHIssue[]>(root + "/issues?state=open&per_page=100"),
      this.api<GHWorkflow>(root + "/actions/runs?per_page=1").catch(() => ({ workflow_runs: [] }))
    ]);
    const gitBranches: GitBranch[] = [];
    for (const branch of branches.slice(0, this.maxBranches)) {
      let committedAt: string | null = null;
      try {
        const commit = await this.api<GHCommit>(root + "/commits/" + encodeURIComponent(branch.commit.sha));
        committedAt = commit.commit.committer?.date ?? commit.commit.author?.date ?? null;
      } catch {
        // Unknown timestamp is kept unknown; never mislabel it as stale.
      }
      gitBranches.push({
        name: branch.name, sha: branch.commit.sha,
        isDefault: branch.name === repo.default_branch,
        lastCommitAt: committedAt,
        url: repo.html_url + "/tree/" + branch.name.split("/").map(encodeURIComponent).join("/")
      });
    }
    const pullRequests: PullRequest[] = prs.map(pr => ({
      number: pr.number, title: pr.title, url: pr.html_url, branch: pr.head.ref,
      createdAt: pr.created_at, updatedAt: pr.updated_at, draft: pr.draft
    }));
    const latest = workflows.workflow_runs[0];
    const latestWorkflow: WorkflowRun | null = latest ? {
      id: latest.id, name: latest.name, conclusion: latest.conclusion,
      status: latest.status, url: latest.html_url,
      createdAt: latest.created_at, branch: latest.head_branch
    } : null;
    return {
      provider: "github", providerId: String(repo.id), slug: repo.full_name,
      name: repo.name, url: repo.html_url, description: repo.description,
      defaultBranch: repo.default_branch, lastActivityAt: repo.pushed_at,
      archived: repo.archived, branches: gitBranches,
      pullRequests, openIssues: issues.filter(issue => !issue.pull_request).length,
      latestWorkflow, observedAt: new Date().toISOString()
    };
  }
}
