import type { GitBranch, ProjectSnapshot, PullRequest, SourceAdapter, WorkflowRun } from "@lookout/core";

export type GitHubAdapterOptions = {
  token: string;
  owner?: string;
  maxRepos?: number;
  includeForks?: boolean;
  maxBranchesPerRepo?: number;
  fetchImpl?: typeof fetch;
};

export type Repo = {
  id: number;
  full_name: string;
  name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  pushed_at: string | null;
  archived: boolean;
  fork: boolean;
  private?: boolean;
  visibility?: string;
};
type GHBranch = { name: string; commit: { sha: string } };
type GHPr = {
  number: number; title: string; html_url: string;
  head: { ref: string; sha?: string }; created_at: string; updated_at: string; draft: boolean;
  body?: string | null; user?: { login: string; type?: string };
  requested_reviewers?: Array<{ login: string }>;
};
type GHIssue = { number: number; pull_request?: object; title?: string; html_url?: string; updated_at?: string; labels?: Array<{ name: string }> };
type GHClosedPR = GHPr & { merged_at?: string | null };
type GHReview = { user?: { login: string }; state: string; submitted_at?: string };
type GHComment = { user?: { login: string }; body?: string; created_at: string };
type GHChecks = { check_runs: Array<{ status: string; conclusion: string | null }> };
type GHDirectoryItem = { name: string; path: string; type: string; size?: number };
type GHContent = { content?: string; encoding?: string };
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
    this.maxRepos = Math.min(500, Math.max(1, options.maxRepos ?? 500));
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
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error("GitHub " + response.status + " " + path + ": " + detail);
    }
    return await response.json() as T;
  }

  async listRepos(): Promise<Repo[]> {
    const repos: Repo[] = [];
    for (let page = 1; repos.length < this.maxRepos; page++) {
      const path = "/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=" + page;
      const batch = await this.api<Repo[]>(path);
      for (const repo of batch) {
        if (this.owner && repo.full_name.split("/")[0]?.toLowerCase() !== this.owner.toLowerCase()) continue;
        if (!repo.archived && (this.includeForks || !repo.fork)) repos.push(repo);
        if (repos.length === this.maxRepos) break;
      }
      if (batch.length < 100) break;
    }
    return repos;
  }

  async discoverInventory(knownRepos?: Repo[]) {
    const repos = knownRepos ?? await this.listRepos();
    return repos.map(repo => ({
      providerId: String(repo.id), slug: repo.full_name, name: repo.name,
      url: repo.html_url, description: repo.description,
      visibility: (repo.visibility === "private" || repo.private === true) ? "private" as const
        : (repo.visibility === "public" || repo.private === false) ? "public" as const : "unknown" as const,
      archived: repo.archived, fork: repo.fork, lastActivityAt: repo.pushed_at
    }));
  }

  async discover(): Promise<ProjectSnapshot[]> {
    const repos = await this.listRepos();
    const snapshots: ProjectSnapshot[] = [];
    for (const repo of repos) snapshots.push(await this.inspect(repo));
    return snapshots;
  }


  /** Read only two reasonably sized Markdown plans. A checkbox is not a verified task state. */
  private async readPlans(root: string, repoUrl: string, defaultBranch: string) {
    const list = async (path: string): Promise<GHDirectoryItem[]> => {
      try {
        const files = await this.api<GHDirectoryItem[]>(root + "/contents/" + path);
        return Array.isArray(files) ? files : [];
      } catch { return []; }
    };
    const [top, docs] = await Promise.all([list(""), list("docs")]);
    const candidates = [...top, ...docs].filter(item =>
      item.type === "file" &&
      /^(roadmap|plan|status|todo|backlog)([-_.].*)?\.md$/i.test(item.name) &&
      (item.size ?? 0) < 64000
    ).sort((a, b) => {
      const score = (s: string) => /roadmap/i.test(s) ? 0 : /status/i.test(s) ? 1 : /plan/i.test(s) ? 2 : 3;
      return score(a.name) - score(b.name) || a.path.localeCompare(b.path);
    }).slice(0, 2);
    const found: Array<{ path: string; url: string; tasks: Array<{ text: string; done: boolean; line: number }> }> = [];
    for (const item of candidates) {
      try {
        const path = item.path.split("/").map(encodeURIComponent).join("/");
        const file = await this.api<GHContent>(root + "/contents/" + path);
        if (file.encoding !== "base64" || !file.content) continue;
        const content = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
        const tasks = content.split(/\r?\n/).flatMap((line, index) => {
          const match = line.match(/^\s*[-*] \[([ xX])\]\s+(.{3,220})$/);
          return match ? [{ text: match[2]!.trim(), done: match[1]!.toLowerCase() === "x", line: index + 1 }] : [];
        }).slice(0, 20);
        found.push({ path: item.path, url: repoUrl + "/blob/" + encodeURIComponent(defaultBranch) + "/" + path, tasks });
      } catch { /* Missing document should not fail observation of branches or PRs. */ }
    }
    return found;
  }

  /** Bounded review, checks and discussion sampling; a 403 leaves status unknown. */
  private async inspectPullContext(root: string, pr: GHPr) {
    const base = root + "/pulls/" + pr.number;
    const [reviews, checks, comments] = await Promise.all([
      this.api<GHReview[]>(base + "/reviews?per_page=50").catch(() => null),
      pr.head.sha ? this.api<GHChecks>(root + "/commits/" + encodeURIComponent(pr.head.sha) + "/check-runs?per_page=50").catch(() => null) : Promise.resolve(null),
      this.api<GHComment[]>(root + "/issues/" + pr.number + "/comments?per_page=20").catch(() => null)
    ]);
    const latest = new Map<string, GHReview>();
    for (const review of reviews ?? []) {
      if (review.user?.login && review.state !== "DISMISSED") latest.set(review.user.login, review);
    }
    const states = [...latest.values()].map(item => item.state);
    const reviewStatus = reviews === null ? "unknown"
      : states.includes("CHANGES_REQUESTED") ? "changes_requested"
      : states.includes("APPROVED") ? "approved"
      : states.includes("COMMENTED") ? "commented" : "none";
    const list = checks?.check_runs ?? [];
    const checksStatus = !checks || !list.length ? "unknown"
      : list.some(x => x.status !== "completed") ? "pending"
      : list.some(x => x.conclusion !== "success" && x.conclusion !== "skipped" && x.conclusion !== "neutral") ? "failure" : "success";
    return {
      reviewStatus: reviewStatus as "approved" | "changes_requested" | "commented" | "none" | "unknown",
      checks: checksStatus as "success" | "failure" | "pending" | "unknown",
      discussion: (comments ?? []).slice(-3).filter(x => x.body).map(item => ({
        author: item.user?.login ?? "Contributor",
        body: (item.body ?? "").slice(0, 1000),
        createdAt: item.created_at
      }))
    };
  }

  async inspect(repo: Repo): Promise<ProjectSnapshot> {
    const root = "/repos/" + repo.full_name.split("/").map(encodeURIComponent).join("/");
    const [branches, prs, issues, workflows, closedPrs, plans] = await Promise.all([
      this.api<GHBranch[]>(root + "/branches?per_page=100"),
      this.api<GHPr[]>(root + "/pulls?state=open&sort=updated&direction=desc&per_page=100"),
      this.api<GHIssue[]>(root + "/issues?state=open&per_page=100"),
      this.api<GHWorkflow>(root + "/actions/runs?per_page=1").catch(() => ({ workflow_runs: [] })),
      this.api<GHClosedPR[]>(root + "/pulls?state=closed&sort=updated&direction=desc&per_page=15").catch(() => []),
      this.readPlans(root, repo.html_url, repo.default_branch)
    ]);
    // Branch timestamps are independent reads. Bound the parallelism to avoid
    // serial latency across large repositories and excessive GitHub API bursts.
    const selectedBranches = branches.slice(0, this.maxBranches);
    const gitBranches: GitBranch[] = [];
    for (let offset = 0; offset < selectedBranches.length; offset += 5) {
      const group = await Promise.all(selectedBranches.slice(offset, offset + 5).map(async branch => {
        let committedAt: string | null = null;
        try {
          const commit = await this.api<GHCommit>(root + "/commits/" + encodeURIComponent(branch.commit.sha));
          committedAt = commit.commit.committer?.date ?? commit.commit.author?.date ?? null;
        } catch { /* Missing commit timestamp stays unknown. */ }
        return {
          name: branch.name, sha: branch.commit.sha,
          isDefault: branch.name === repo.default_branch,
          lastCommitAt: committedAt,
          url: repo.html_url + "/tree/" + branch.name.split("/").map(encodeURIComponent).join("/")
        };
      }));
      gitBranches.push(...group);
    }
    const detailed = await Promise.all(prs.slice(0, 5).map(pr => this.inspectPullContext(root, pr)));
    const pullRequests: PullRequest[] = prs.map((pr, index) => ({
      number: pr.number, title: pr.title, url: pr.html_url, branch: pr.head.ref,
      createdAt: pr.created_at, updatedAt: pr.updated_at, draft: pr.draft,
      body: index < 12 ? pr.body?.slice(0, 12000) ?? null : null,
      author: pr.user?.login, isBot: pr.user?.type === "Bot" || /[bot]$/i.test(pr.user?.login ?? ""),
      requestedReviewers: pr.requested_reviewers?.length,
      ...(detailed[index] ?? {})
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
      workIssues: issues.filter(issue => !issue.pull_request && issue.title && issue.html_url)
        .slice(0, 30).map(issue => ({
          number: issue.number, title: issue.title!, url: issue.html_url!,
          updatedAt: issue.updated_at ?? new Date(0).toISOString(),
          labels: (issue.labels ?? []).map(label => label.name)
        })),
      recentMerges: closedPrs.filter(pr => pr.merged_at).slice(0, 6).map(pr => ({
        number: pr.number, title: pr.title, url: pr.html_url, branch: pr.head.ref,
        mergedAt: pr.merged_at!, body: pr.body?.slice(0, 10000) ?? null,
        isBot: pr.user?.type === "Bot" || /[bot]$/i.test(pr.user?.login ?? "")
      })),
      planningDocuments: plans,
      latestWorkflow, observedAt: new Date().toISOString()
    };
  }
}
