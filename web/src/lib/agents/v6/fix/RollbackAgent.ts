/**
 * RollbackAgent — reverts a worktree to a clean state.
 *
 * Two-step rollback:
 *   1. `git reset --hard HEAD` (drops applied but uncommitted changes)
 *   2. `git clean -fd`         (removes any new files)
 *
 * Critical safety: only ever runs inside ctx.worktreePath.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import { WorktreeRunner } from "../WorktreeRunner";

export interface RollbackInput {
  /** Reason for rollback (logged as evidence) */
  reason?: string;
}

export interface RollbackOutput {
  /** Whether the rollback succeeded fully */
  rolledBack: boolean;
  /** Output from `git reset` */
  resetOutput: string;
  /** Output from `git clean` */
  cleanOutput: string;
}

export class RollbackAgent extends BaseAgentV6<RollbackInput, RollbackOutput> {
  readonly id = "fix.rollback";
  readonly name = "Worktree Rollback";
  readonly fleet: FleetName = "fix";
  readonly role = "validator" as const;
  readonly description = "Reverts a worktree to HEAD and removes untracked files";

  private readonly runner: WorktreeRunner;

  constructor(repoRoot: string) {
    super();
    this.runner = new WorktreeRunner(repoRoot);
  }

  canRunInWorktree(): boolean {
    return true;
  }

  protected async run(
    input: RollbackInput,
    ctx: AgentContextV6,
  ): Promise<{ output: RollbackOutput; evidence?: string[] }> {
    if (!ctx.worktreePath) {
      throw new Error("RollbackAgent requires ctx.worktreePath — never reset main");
    }
    const handle = {
      id: "external",
      path: ctx.worktreePath,
      branch: "",
      createdAt: 0,
    };

    const reset = await this.runner.run(handle, "git", ["reset", "--hard", "HEAD"], {
      timeoutMs: 30_000,
      signal: ctx.signal,
    });
    const clean = await this.runner.run(handle, "git", ["clean", "-fd"], {
      timeoutMs: 30_000,
      signal: ctx.signal,
    });

    const rolledBack = reset.success && clean.success;
    ctx.logger.info(
      `[rollback] worktree=${ctx.worktreePath} success=${rolledBack} reason="${input.reason ?? ""}"`,
    );

    return {
      output: {
        rolledBack,
        resetOutput: `${reset.stdout}\n${reset.stderr}`.slice(-2048),
        cleanOutput: `${clean.stdout}\n${clean.stderr}`.slice(-2048),
      },
      evidence: [`rolledBack=${rolledBack}`, `reason=${input.reason ?? "n/a"}`],
    };
  }
}
