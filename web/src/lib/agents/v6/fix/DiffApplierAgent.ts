/**
 * DiffApplierAgent — applies a unified diff inside a worktree.
 *
 * Hard constraint: never operates on the main repo. Throws if ctx.worktreePath
 * is undefined.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import { WorktreeRunner } from "../WorktreeRunner";

export interface DiffApplierInput {
  /** Unified diff content */
  diff: string;
}

export interface DiffApplierOutput {
  applied: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class DiffApplierAgent extends BaseAgentV6<DiffApplierInput, DiffApplierOutput> {
  readonly id = "fix.diff-applier";
  readonly name = "Diff Applier";
  readonly fleet: FleetName = "fix";
  readonly role = "validator" as const;
  readonly description = "Applies a unified diff inside a worktree (never touches main)";

  private readonly runner: WorktreeRunner;

  constructor(repoRoot: string) {
    super();
    this.runner = new WorktreeRunner(repoRoot);
  }

  canRunInWorktree(): boolean {
    return true;
  }

  protected async run(
    input: DiffApplierInput,
    ctx: AgentContextV6,
  ): Promise<{ output: DiffApplierOutput; evidence?: string[] }> {
    if (!ctx.worktreePath) {
      throw new Error("DiffApplierAgent requires ctx.worktreePath — never apply to main");
    }
    const handle = {
      id: "external",
      path: ctx.worktreePath,
      branch: "",
      createdAt: 0,
    };

    const result = await this.runner.applyDiff(handle, input.diff);
    ctx.logger.info(
      `[diff-applier] worktree=${ctx.worktreePath} applied=${result.success}`,
    );

    return {
      output: {
        applied: result.success,
        stdout: result.stdout.slice(-2048),
        stderr: result.stderr.slice(-2048),
        durationMs: result.durationMs,
      },
      evidence: [`applied=${result.success}`, `exit=${result.exitCode}`],
    };
  }
}
