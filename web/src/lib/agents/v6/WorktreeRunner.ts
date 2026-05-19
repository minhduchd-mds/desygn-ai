/**
 * WorktreeRunner — Git worktree isolation for parallel agent execution.
 *
 * Inspired by Orca's worktree-native architecture. Each self-improvement task
 * runs in its own worktree at `.worktrees/{id}` so multiple agents can edit
 * code simultaneously without conflicts.
 *
 * Design constraints:
 *   - Server-side only (uses Node child_process)
 *   - No worktree may outlive the current process by >24h (auto-cleanup)
 *   - All commands captured for evidence logging
 *   - Optional TTL (default 10 min) per command
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readdir, stat, rm } from "node:fs/promises";
import { join } from "node:path";

const WORKTREE_ROOT = ".worktrees";
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Whether exitCode === 0 */
  success: boolean;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Wall-clock duration in ms */
  durationMs: number;
  /** True if the command was killed due to TTL */
  timedOut: boolean;
}

export interface WorktreeHandle {
  /** Worktree ID (used in path: .worktrees/{id}) */
  id: string;
  /** Absolute path to the worktree */
  path: string;
  /** Branch name created for this worktree */
  branch: string;
  /** Timestamp the worktree was created */
  createdAt: number;
}

export interface RunOptions {
  /** Override the per-command TTL (ms). Default 10 min. */
  timeoutMs?: number;
  /** Environment variables to add to the spawned process */
  env?: Record<string, string>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// ─────────────────────────────────────────────────────────────────────────────
// WorktreeRunner
// ─────────────────────────────────────────────────────────────────────────────

export class WorktreeRunner {
  /** Absolute path to the repo root (the directory containing .git) */
  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Create a new worktree at `.worktrees/{id}` on a fresh branch.
   * Branch name: `agent/{id}` to namespace from human work.
   */
  async create(id: string, baseBranch = "main"): Promise<WorktreeHandle> {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid worktree id "${id}" — must match [a-zA-Z0-9_-]+`);
    }
    const branch = `agent/${id}`;
    const worktreePath = join(this.repoRoot, WORKTREE_ROOT, id);
    await mkdir(join(this.repoRoot, WORKTREE_ROOT), { recursive: true });

    const result = await this.runRaw(
      "git",
      ["worktree", "add", "-b", branch, worktreePath, baseBranch],
      { cwd: this.repoRoot },
    );
    if (!result.success) {
      throw new Error(`git worktree add failed: ${result.stderr}`);
    }

    return {
      id,
      path: worktreePath,
      branch,
      createdAt: Date.now(),
    };
  }

  /**
   * Run a command inside the worktree. Captures stdout/stderr, enforces TTL.
   */
  async run(
    handle: WorktreeHandle,
    command: string,
    args: string[],
    options: RunOptions = {},
  ): Promise<CommandResult> {
    return this.runRaw(command, args, {
      cwd: handle.path,
      timeoutMs: options.timeoutMs,
      env: options.env,
      signal: options.signal,
    });
  }

  /**
   * Remove a worktree and its branch. Force-removes uncommitted changes.
   */
  async remove(handle: WorktreeHandle): Promise<void> {
    // Remove worktree (uses --force because the branch may have unmerged commits)
    await this.runRaw(
      "git",
      ["worktree", "remove", "--force", handle.path],
      { cwd: this.repoRoot },
    );
    // Best-effort branch delete (-D = force)
    await this.runRaw(
      "git",
      ["branch", "-D", handle.branch],
      { cwd: this.repoRoot },
    );
  }

  /**
   * Sweep stale worktrees (older than STALE_TTL_MS).
   * Returns the IDs that were removed.
   */
  async sweepStale(): Promise<string[]> {
    const root = join(this.repoRoot, WORKTREE_ROOT);
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch {
      return [];
    }

    const removed: string[] = [];
    const cutoff = Date.now() - STALE_TTL_MS;

    for (const id of entries) {
      const dir = join(root, id);
      try {
        const s = await stat(dir);
        if (s.isDirectory() && s.mtimeMs < cutoff) {
          await rm(dir, { recursive: true, force: true });
          removed.push(id);
        }
      } catch {
        // ignore — directory may have been removed concurrently
      }
    }

    return removed;
  }

  /**
   * Apply a unified diff inside the worktree using `git apply`.
   * Returns success=true only when the apply was clean.
   */
  async applyDiff(handle: WorktreeHandle, diff: string): Promise<CommandResult> {
    return new Promise((resolve) => {
      const child: ChildProcess = spawn("git", ["apply", "--whitespace=fix"], {
        cwd: handle.path,
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      const started = Date.now();

      child.stdout?.on("data", (d: Buffer) => stdoutChunks.push(d));
      child.stderr?.on("data", (d: Buffer) => stderrChunks.push(d));

      child.on("close", (code) => {
        resolve({
          exitCode: code ?? -1,
          success: code === 0,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          durationMs: Date.now() - started,
          timedOut: false,
        });
      });

      child.stdin?.write(diff);
      child.stdin?.end();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  private runRaw(
    command: string,
    args: string[],
    options: {
      cwd: string;
      timeoutMs?: number;
      env?: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const timeoutMs = options.timeoutMs ?? DEFAULT_TTL_MS;
      const started = Date.now();
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...(options.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;

      const ttlTimer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000);
      }, timeoutMs);

      const onAbort = () => {
        child.kill("SIGTERM");
      };
      options.signal?.addEventListener("abort", onAbort);

      child.stdout?.on("data", (d: Buffer) => stdoutChunks.push(d));
      child.stderr?.on("data", (d: Buffer) => stderrChunks.push(d));

      child.on("close", (code) => {
        clearTimeout(ttlTimer);
        options.signal?.removeEventListener("abort", onAbort);
        resolve({
          exitCode: code ?? -1,
          success: code === 0,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          durationMs: Date.now() - started,
          timedOut,
        });
      });

      child.on("error", (err) => {
        clearTimeout(ttlTimer);
        resolve({
          exitCode: -1,
          success: false,
          stdout: "",
          stderr: err.message,
          durationMs: Date.now() - started,
          timedOut: false,
        });
      });
    });
  }
}
