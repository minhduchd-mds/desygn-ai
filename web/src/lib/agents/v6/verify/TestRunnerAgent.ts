/**
 * TestRunnerAgent — wraps `npx vitest run` as an agent.
 *
 * Runs in either the main repo (if ctx.worktreePath is undefined) or inside a
 * worktree. Captures vitest output and parses pass/fail counts for evidence.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import { WorktreeRunner } from "../WorktreeRunner";

export interface TestRunnerInput {
  /** Optional filter (passed as positional arg to vitest) */
  filter?: string;
  /** Reporter (default "dot" for compact output) */
  reporter?: "dot" | "verbose" | "json";
  /** Override per-run timeout (default 5 minutes) */
  timeoutMs?: number;
}

export interface TestRunnerOutput {
  /** Whether vitest exited 0 */
  passed: boolean;
  /** Number of test files */
  files: number;
  /** Number of passing tests */
  tests: number;
  /** Number of failing tests */
  failed: number;
  /** Raw stdout (truncated to 4 KB) */
  stdout: string;
  /** Raw stderr (truncated to 4 KB) */
  stderr: string;
  /** Wall-clock duration in ms */
  durationMs: number;
}

const FILES_RE = /Test Files\s+(\d+)\s+passed/i;
const TESTS_RE = /Tests\s+(\d+)\s+passed/i;
const FAILED_RE = /(\d+)\s+failed/i;

export class TestRunnerAgent extends BaseAgentV6<TestRunnerInput, TestRunnerOutput> {
  readonly id = "verify.test-runner";
  readonly name = "Vitest Test Runner";
  readonly fleet: FleetName = "verify";
  readonly role = "validator" as const;
  readonly description = "Runs the vitest test suite and reports pass/fail counts";

  private readonly runner: WorktreeRunner;

  constructor(repoRoot: string) {
    super();
    this.runner = new WorktreeRunner(repoRoot);
  }

  protected async run(
    input: TestRunnerInput,
    ctx: AgentContextV6,
  ): Promise<{ output: TestRunnerOutput; costUsd?: number; evidence?: string[] }> {
    const reporter = input.reporter ?? "dot";
    const args = ["vitest", "run", "--reporter", reporter];
    if (input.filter) args.push(input.filter);

    // If a worktree is provided, run inside it; otherwise run in the main repo.
    const handle = ctx.worktreePath
      ? { id: "external", path: ctx.worktreePath, branch: "", createdAt: 0 }
      : { id: "main", path: process.cwd(), branch: "main", createdAt: 0 };

    const result = await this.runner.run(handle, "npx", args, {
      timeoutMs: input.timeoutMs ?? 5 * 60 * 1000,
      signal: ctx.signal,
    });

    const output = parseVitestOutput(result.stdout, result.stderr, result.durationMs, result.success);
    return {
      output,
      evidence: [
        `test-runner: ${output.tests} tests / ${output.files} files`,
        `exit=${result.exitCode}`,
      ],
    };
  }
}

function parseVitestOutput(
  stdout: string,
  stderr: string,
  durationMs: number,
  passed: boolean,
): TestRunnerOutput {
  const filesMatch = stdout.match(FILES_RE);
  const testsMatch = stdout.match(TESTS_RE);
  const failedMatch = stdout.match(FAILED_RE);

  return {
    passed,
    files: filesMatch ? Number.parseInt(filesMatch[1], 10) : 0,
    tests: testsMatch ? Number.parseInt(testsMatch[1], 10) : 0,
    failed: failedMatch ? Number.parseInt(failedMatch[1], 10) : 0,
    stdout: stdout.slice(-4096),
    stderr: stderr.slice(-4096),
    durationMs,
  };
}
