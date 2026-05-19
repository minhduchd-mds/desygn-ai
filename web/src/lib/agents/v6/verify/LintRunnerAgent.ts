/**
 * LintRunnerAgent — wraps `npx eslint` as an agent.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import { WorktreeRunner } from "../WorktreeRunner";

export interface LintRunnerInput {
  /** File or directory globs to lint (defaults to whole repo) */
  paths?: string[];
  /** Whether to apply autofixes */
  fix?: boolean;
  /** Max warnings before failing (default 0) */
  maxWarnings?: number;
}

export interface LintRunnerOutput {
  /** Whether eslint exited 0 */
  passed: boolean;
  /** Parsed problem count */
  errors: number;
  /** Parsed warning count */
  warnings: number;
  /** Raw output (truncated to 4 KB) */
  output: string;
}

const SUMMARY_RE = /(\d+)\s+(?:problem|problems)\s+\((\d+)\s+(?:error|errors),\s+(\d+)\s+(?:warning|warnings)\)/i;

export class LintRunnerAgent extends BaseAgentV6<LintRunnerInput, LintRunnerOutput> {
  readonly id = "verify.lint-runner";
  readonly name = "ESLint Runner";
  readonly fleet: FleetName = "verify";
  readonly role = "validator" as const;
  readonly description = "Runs ESLint and reports error/warning counts";

  private readonly runner: WorktreeRunner;

  constructor(repoRoot: string) {
    super();
    this.runner = new WorktreeRunner(repoRoot);
  }

  protected async run(
    input: LintRunnerInput,
    ctx: AgentContextV6,
  ): Promise<{ output: LintRunnerOutput; evidence?: string[] }> {
    const args = ["eslint"];
    if (input.maxWarnings !== undefined) {
      args.push("--max-warnings", String(input.maxWarnings));
    }
    if (input.fix) args.push("--fix");
    if (input.paths?.length) {
      args.push(...input.paths);
    } else {
      args.push(".");
    }

    const handle = ctx.worktreePath
      ? { id: "external", path: ctx.worktreePath, branch: "", createdAt: 0 }
      : { id: "main", path: process.cwd(), branch: "main", createdAt: 0 };

    const result = await this.runner.run(handle, "npx", args, {
      timeoutMs: 5 * 60 * 1000,
      signal: ctx.signal,
    });

    const combined = `${result.stdout}\n${result.stderr}`;
    const match = combined.match(SUMMARY_RE);
    const errors = match ? Number.parseInt(match[2], 10) : 0;
    const warnings = match ? Number.parseInt(match[3], 10) : 0;

    return {
      output: {
        passed: result.success,
        errors,
        warnings,
        output: combined.slice(-4096),
      },
      evidence: [`lint: ${errors} errors, ${warnings} warnings`, `exit=${result.exitCode}`],
    };
  }
}
