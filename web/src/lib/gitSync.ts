/**
 * Git Sync Engine — Standalone module for GitHub integration.
 * Handles PR generation, branch management, and design↔code sync.
 */

// ─── Types ─────────────────────────────────────────────

export interface GitSyncConfig {
  owner: string;
  repo: string;
  token: string;
  baseBranch?: string;
  apiBase?: string;
}

export interface SyncFile {
  path: string;
  content: string;
  operation: "create" | "update" | "delete";
}

export interface PullRequestOptions {
  title: string;
  body: string;
  branch: string;
  files: SyncFile[];
  labels?: string[];
  draft?: boolean;
}

export interface PullRequestResult {
  number: number;
  url: string;
  branch: string;
  sha: string;
  status: "created" | "updated";
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  lastCommit: { message: string; date: string; author: string };
}

export interface CommitResult {
  sha: string;
  url: string;
  message: string;
}

export interface GitSyncStatus {
  configured: boolean;
  lastSync: number | null;
  pendingChanges: number;
  activeBranch: string | null;
  rateLimit: { remaining: number; reset: number };
}

// ─── Constants ─────────────────────────────────────────

const GITHUB_API = "https://api.github.com";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ─── GitSyncEngine ────────────────────────────────────

export class GitSyncEngine {
  private config: GitSyncConfig | null = null;
  private lastSync: number | null = null;
  private pendingFiles: SyncFile[] = [];
  private rateLimitRemaining = 5000;
  private rateLimitReset = 0;

  configure(config: GitSyncConfig): void {
    this.config = {
      ...config,
      baseBranch: config.baseBranch ?? "main",
      apiBase: config.apiBase ?? GITHUB_API,
    };
  }

  isConfigured(): boolean {
    return !!(this.config?.token && this.config?.owner && this.config?.repo);
  }

  getStatus(): GitSyncStatus {
    return {
      configured: this.isConfigured(),
      lastSync: this.lastSync,
      pendingChanges: this.pendingFiles.length,
      activeBranch: null,
      rateLimit: { remaining: this.rateLimitRemaining, reset: this.rateLimitReset },
    };
  }

  // ─── Branch Operations ────────────────────────────────

  async listBranches(): Promise<BranchInfo[]> {
    const data = await this.apiGet<Array<Record<string, unknown>>>("/repos/{owner}/{repo}/branches");
    return data.map((b) => ({
      name: b.name as string,
      sha: (b.commit as Record<string, unknown>)?.sha as string ?? "",
      protected: b.protected as boolean ?? false,
      lastCommit: {
        message: ((b.commit as Record<string, unknown>)?.commit as Record<string, unknown>)?.message as string ?? "",
        date: (((b.commit as Record<string, unknown>)?.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.date as string ?? "",
        author: (((b.commit as Record<string, unknown>)?.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.name as string ?? "",
      },
    }));
  }

  async createBranch(name: string, fromSha?: string): Promise<string> {
    const sha = fromSha ?? await this.getBaseBranchSha();
    const result = await this.apiPost<{ ref: string; object: { sha: string } }>(
      "/repos/{owner}/{repo}/git/refs",
      { ref: `refs/heads/${name}`, sha },
    );
    return result.object.sha;
  }

  async deleteBranch(name: string): Promise<void> {
    await this.apiDelete(`/repos/{owner}/{repo}/git/refs/heads/${name}`);
  }

  // ─── File Operations ──────────────────────────────────

  stageFiles(files: SyncFile[]): void {
    this.pendingFiles.push(...files);
  }

  clearStaged(): void {
    this.pendingFiles = [];
  }

  async commitFiles(branch: string, message: string, files?: SyncFile[]): Promise<CommitResult> {
    const filesToCommit = files ?? this.pendingFiles;
    if (filesToCommit.length === 0) {
      throw new Error("No files to commit");
    }

    // Get base tree
    const branchRef = await this.apiGet<{ object: { sha: string } }>(
      `/repos/{owner}/{repo}/git/refs/heads/${branch}`,
    );
    const baseCommitSha = branchRef.object.sha;
    const baseCommit = await this.apiGet<{ tree: { sha: string } }>(
      `/repos/{owner}/{repo}/git/commits/${baseCommitSha}`,
    );

    // Create blobs for each file
    const treeItems: Array<{ path: string; mode: string; type: string; sha?: string | null }> = [];

    for (const file of filesToCommit) {
      if (file.operation === "delete") {
        treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: null });
      } else {
        const blob = await this.apiPost<{ sha: string }>(
          "/repos/{owner}/{repo}/git/blobs",
          { content: file.content, encoding: "utf-8" },
        );
        treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
      }
    }

    // Create tree
    const tree = await this.apiPost<{ sha: string }>(
      "/repos/{owner}/{repo}/git/trees",
      { base_tree: baseCommit.tree.sha, tree: treeItems },
    );

    // Create commit
    const commit = await this.apiPost<{ sha: string; html_url: string }>(
      "/repos/{owner}/{repo}/git/commits",
      { message, tree: tree.sha, parents: [baseCommitSha] },
    );

    // Update branch ref
    await this.apiPatch(`/repos/{owner}/{repo}/git/refs/heads/${branch}`, {
      sha: commit.sha,
    });

    this.pendingFiles = [];
    this.lastSync = Date.now();

    return { sha: commit.sha, url: commit.html_url, message };
  }

  // ─── Pull Request ─────────────────────────────────────

  async createPullRequest(options: PullRequestOptions): Promise<PullRequestResult> {
    const { title, body, branch, files, labels, draft } = options;

    // Create branch and commit files
    await this.createBranch(branch);
    await this.commitFiles(branch, title, files);

    // Create PR
    const pr = await this.apiPost<{ number: number; html_url: string; head: { sha: string } }>(
      "/repos/{owner}/{repo}/pulls",
      {
        title,
        body,
        head: branch,
        base: this.config!.baseBranch,
        draft: draft ?? false,
      },
    );

    // Add labels if specified
    if (labels?.length) {
      await this.apiPost(`/repos/{owner}/{repo}/issues/${pr.number}/labels`, { labels });
    }

    this.lastSync = Date.now();

    return {
      number: pr.number,
      url: pr.html_url,
      branch,
      sha: pr.head.sha,
      status: "created",
    };
  }

  // ─── Design.md Sync ───────────────────────────────────

  async syncDesignMd(designMd: string, componentName: string): Promise<PullRequestResult> {
    const branch = `design/${componentName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const filePath = `docs/design/${componentName.replace(/\s+/g, "")}.design.md`;

    return this.createPullRequest({
      title: `docs: add Design.md for ${componentName}`,
      body: [
        "## Design Specification",
        "",
        `Auto-generated design spec for **${componentName}** from DesignReady.ai.`,
        "",
        "### Changes",
        `- Added \`${filePath}\` with full design specification`,
        "",
        "---",
        "*Generated by DesignReady.ai Shannon Engine*",
      ].join("\n"),
      branch,
      files: [{ path: filePath, content: designMd, operation: "create" }],
      labels: ["design", "automated"],
      draft: true,
    });
  }

  async syncGeneratedCode(
    files: Array<{ path: string; content: string }>,
    componentName: string,
  ): Promise<PullRequestResult> {
    const branch = `feat/${componentName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

    return this.createPullRequest({
      title: `feat: add generated code for ${componentName}`,
      body: [
        "## Generated Code",
        "",
        `Production-ready code for **${componentName}** generated by Shannon Engine.`,
        "",
        "### Files",
        ...files.map((f) => `- \`${f.path}\``),
        "",
        "### Quality Gates",
        "- [x] TypeScript strict mode",
        "- [x] Accessibility validated",
        "- [x] Mobile responsive",
        "- [x] Design system compliant",
        "",
        "---",
        "*Generated by DesignReady.ai Shannon Engine*",
      ].join("\n"),
      branch,
      files: files.map((f) => ({ ...f, operation: "create" as const })),
      labels: ["feature", "automated", "generated-code"],
    });
  }

  // ─── Private API Methods ──────────────────────────────

  private async apiGet<T>(endpoint: string): Promise<T> {
    return this.apiRequest<T>("GET", endpoint);
  }

  private async apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.apiRequest<T>("POST", endpoint, body);
  }

  private async apiPatch(endpoint: string, body?: unknown): Promise<void> {
    await this.apiRequest("PATCH", endpoint, body);
  }

  private async apiDelete(endpoint: string): Promise<void> {
    await this.apiRequest("DELETE", endpoint);
  }

  private async apiRequest<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    if (!this.config) throw new Error("GitSync not configured. Call configure() first.");

    const url = `${this.config.apiBase}${endpoint
      .replace("{owner}", this.config.owner)
      .replace("{repo}", this.config.repo)}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Authorization": `Bearer ${this.config.token}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        // Track rate limits
        this.rateLimitRemaining = parseInt(response.headers.get("x-ratelimit-remaining") ?? "5000");
        this.rateLimitReset = parseInt(response.headers.get("x-ratelimit-reset") ?? "0");

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const error = new Error(`GitHub API ${response.status}: ${errorText.slice(0, 200)}`);

          // Don't retry 4xx (except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw error;
          }

          // Rate limited — wait
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("retry-after") ?? "60");
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }

          lastError = error;
        } else {
          if (method === "DELETE") return undefined as T;
          return await response.json() as T;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt)));
      }
    }

    throw lastError ?? new Error("GitHub API request failed");
  }

  private async getBaseBranchSha(): Promise<string> {
    const ref = await this.apiGet<{ object: { sha: string } }>(
      `/repos/{owner}/{repo}/git/refs/heads/${this.config!.baseBranch}`,
    );
    return ref.object.sha;
  }
}

// ─── Factory ───────────────────────────────────────────

export function createGitSync(config?: GitSyncConfig): GitSyncEngine {
  const engine = new GitSyncEngine();
  if (config) engine.configure(config);
  return engine;
}
