/**
 * BuildVerifierAgent — runs typecheck + build to verify the worktree is shippable.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import { WorktreeRunner } from "../WorktreeRunner";

export interface BuildVerifierInput {
  /** Skip the typecheck step (default false) */
  skipTypecheck?: boolean;
  /** Skip the build step (default false) */
  skipBuild?: boolean;
  /** Build script name (default "web:build") */
  buildScript?: string;
}

export interface BuildVerifierOutput {
  /** Whether all enabled steps passed */
  passed: boolean;
  /** Typecheck step result */
  typecheck: { passed: boolean; output: string };
  /** Build step result */
  build: { passed: boolean; output: string };
}

export class BuildVerifierAgent extends BaseAgentV6<BuildVerifierInput, BuildVerifierOutput> {
  readonly id = "verify.build-verifier";
  readonly name = "Build Verifier";
  readonly fleet: FleetName = "verify";
  readonly role = "validator" as const;
  readonly description = "Runs typecheck + build to confirm the codebase compiles and packages";

  private readonly runner: WorktreeRunner;

  constructor(repoRoot: string) {
    super();
    this.runner = new WorktreeRunner(repoRoot);
  }

  protected async run(
    input: BuildVerifierInput,
    ctx: AgentContextV6,
  ): Promise<{ output: BuildVerifierOutput; evidence?: string[] }> {
    const handle = ctx.worktreePath
      ? { id: "external", path: ctx.worktreePath, branch: "", createdAt: 0 }
      : { id: "main", path: process.cwd(), branch: "main", createdAt: 0 };

    const tcResult = input.skipTypecheck
      ? { exitCode: 0, success: true, stdout: "(skipped)", stderr: "", durationMs: 0, timedOut: false }
      : await this.runner.run(handle, "npx", ["tsc", "--noEmit", "--skipLibCheck"], {
          timeoutMs: 3 * 60 * 1000,
          signal: ctx.signal,
        });

    const buildResult = input.skipBuild
      ? { exitCode: 0, success: true, stdout: "(skipped)", stderr: "", durationMs: 0, timedOut: false }
      : await this.runner.run(
          handle,
          "npm",
          ["run", input.buildScript ?? "web:build"],
          {
            timeoutMs: 5 * 60 * 1000,
            signal: ctx.signal,
            env: { NODE_ENV: "production" },
          },
        );

    const typecheck = {
      passed: tcResult.success,
      output: `${tcResult.stdout}\n${tcResult.stderr}`.slice(-4096),
    };
    const build = {
      passed: buildResult.success,
      output: `${buildResult.stdout}\n${buildResult.stderr}`.slice(-4096),
    };
    const passed = typecheck.passed && build.passed;

    return {
      output: { passed, typecheck, build },
      evidence: [
        `typecheck=${typecheck.passed ? "pass" : "fail"}`,
        `build=${build.passed ? "pass" : "fail"}`,
      ],
    };
  }
}
