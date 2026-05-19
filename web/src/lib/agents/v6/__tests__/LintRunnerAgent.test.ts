import { describe, it, expect, vi, beforeEach } from "vitest";
import { LintRunnerAgent } from "../verify/LintRunnerAgent";
import type { AgentContextV6 } from "../BaseAgent";

vi.mock("../WorktreeRunner", () => {
  const mockRun = vi.fn();
  return {
    WorktreeRunner: class MockRunner { run = mockRun; },
    __mockRun: mockRun,
  };
});

const { __mockRun: mockRun } = await import("../WorktreeRunner") as unknown as { __mockRun: ReturnType<typeof vi.fn> };

function makeCtx(overrides: Partial<AgentContextV6> = {}): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

describe("LintRunnerAgent", () => {
  beforeEach(() => { mockRun.mockReset(); });

  it("reports clean lint", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 2000, timedOut: false });
    const result = await new LintRunnerAgent("/repo").execute({}, makeCtx());
    expect(result.output!.passed).toBe(true);
    expect(result.output!.errors).toBe(0);
  });

  it("parses error and warning counts", async () => {
    mockRun.mockResolvedValue({ exitCode: 1, success: false, stdout: "\n✖ 5 problems (3 errors, 2 warnings)\n", stderr: "", durationMs: 1000, timedOut: false });
    const result = await new LintRunnerAgent("/repo").execute({}, makeCtx());
    expect(result.output!.errors).toBe(3);
    expect(result.output!.warnings).toBe(2);
  });

  it("passes custom paths", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 500, timedOut: false });
    await new LintRunnerAgent("/repo").execute({ paths: ["src/lib", "src/components"] }, makeCtx());
    expect(mockRun.mock.calls[0][2]).toContain("src/lib");
  });

  it("passes --fix flag", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 500, timedOut: false });
    await new LintRunnerAgent("/repo").execute({ fix: true }, makeCtx());
    expect(mockRun.mock.calls[0][2]).toContain("--fix");
  });

  it("passes --max-warnings", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 500, timedOut: false });
    await new LintRunnerAgent("/repo").execute({ maxWarnings: 5 }, makeCtx());
    expect(mockRun.mock.calls[0][2]).toContain("--max-warnings");
  });

  it("defaults to '.' when no paths", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 500, timedOut: false });
    await new LintRunnerAgent("/repo").execute({}, makeCtx());
    expect(mockRun.mock.calls[0][2]).toContain(".");
  });

  it("uses worktree path when provided", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 100, timedOut: false });
    await new LintRunnerAgent("/repo").execute({}, makeCtx({ worktreePath: "/tmp/wt" }));
    expect(mockRun.mock.calls[0][0].path).toBe("/tmp/wt");
  });
});
