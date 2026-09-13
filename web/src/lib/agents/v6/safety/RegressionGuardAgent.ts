/**
 * RegressionGuardAgent — unified gate that blocks bad patches.
 *
 * Composes the 3 existing verify agents (TestRunner, LintRunner, BuildVerifier)
 * into a single pass/fail verdict. If ANY check fails, the guard blocks the patch.
 *
 * Run sequence: lint → typecheck/build → test (fail-fast: stops on first failure).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RegressionGuardInput {
  /** Working directory (worktree path or repo root) */
  cwd: string;
  /** Skip specific checks */
  skip?: ("lint" | "build" | "test")[];
  /** Test file glob pattern (optional, default: run all tests) */
  testPattern?: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

export interface RegressionGuardOutput {
  /** Overall verdict: all checks passed */
  passed: boolean;
  /** Individual check results */
  checks: CheckResult[];
  /** First failing check name (null if all passed) */
  failedAt: string | null;
  /** Total wall-clock time */
  totalDurationMs: number;
}

function validateTestPattern(pattern: string): string {
  const value = pattern.trim();
  if (!value || value.startsWith("-") || /[\0\r\n]/.test(value)) {
    throw new Error("Invalid test pattern");
  }
  return value;
}

function resolveExecutable(command: string): string {
  if (process.platform === "win32" && command === "npx") return "npx.cmd";
  return command;
}

export class RegressionGuardAgent extends BaseAgentV6<RegressionGuardInput, RegressionGuardOutput> {
  readonly id = "safety.regression-guard";
  readonly name = "Regression Guard";
  readonly fleet: FleetName = "safety";
  readonly role = "validator" as const;
  readonly description = "Runs lint + build + test and blocks patches that fail any check";

  protected async run(
    input: RegressionGuardInput,
    ctx: AgentContextV6,
  ): Promise<{ output: RegressionGuardOutput; evidence?: string[] }> {
    const skip = new Set(input.skip ?? []);
    const checks: CheckResult[] = [];
    const started = Date.now();
    let failedAt: string | null = null;

    // 1. Lint
    if (!skip.has("lint") && !failedAt) {
      const result = await this.runCommand(
        input.cwd,
        "npx",
        ["eslint", ".", "--max-warnings=0", "--format=compact"],
        "lint",
        ctx,
      );
      checks.push(result);
      if (!result.passed) failedAt = "lint";
    }

    // 2. Build (typecheck)
    if (!skip.has("build") && !failedAt) {
      const result = await this.runCommand(
        input.cwd,
        "npx",
        ["tsc", "--noEmit"],
        "build",
        ctx,
      );
      checks.push(result);
      if (!result.passed) failedAt = "build";
    }

    // 3. Tests
    if (!skip.has("test") && !failedAt) {
      const args = ["vitest", "run", "--reporter=verbose"];
      if (input.testPattern) args.push(validateTestPattern(input.testPattern));
      const result = await this.runCommand(input.cwd, "npx", args, "test", ctx);
      checks.push(result);
      if (!result.passed) failedAt = "test";
    }

    const totalDurationMs = Date.now() - started;
    const passed = failedAt === null;

    ctx.logger.info(
      `[regression-guard] verdict=${passed ? "PASS" : "FAIL"} ${failedAt ? `(failed at ${failedAt})` : ""} ${totalDurationMs}ms`,
    );

    return {
      output: { passed, checks, failedAt, totalDurationMs },
      evidence: [
        `verdict=${passed ? "pass" : "fail"}`,
        `checks=${checks.map((c) => `${c.name}:${c.passed ? "ok" : "fail"}`).join(",")}`,
      ],
    };
  }

  private runCommand(
    cwd: string,
    command: string,
    args: string[],
    name: string,
    ctx: AgentContextV6,
  ): Promise<CheckResult> {
    return new Promise((resolve) => {
      const started = Date.now();
      const child: ChildProcess = spawn(resolveExecutable(command), args, {
        cwd,
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });

      const chunks: Buffer[] = [];
      child.stdout?.on("data", (d: Buffer) => chunks.push(d));
      child.stderr?.on("data", (d: Buffer) => chunks.push(d));

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
      }, 120_000);

      child.on("close", (code: number | null) => {
        clearTimeout(timeout);
        const output = Buffer.concat(chunks).toString("utf8").slice(-4096);
        ctx.logger.info(`[regression-guard] ${name}: exit=${code ?? -1}`);
        resolve({
          name,
          passed: code === 0,
          output,
          durationMs: Date.now() - started,
        });
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeout);
        resolve({
          name,
          passed: false,
          output: err.message,
          durationMs: Date.now() - started,
        });
      });
    });
  }
}
