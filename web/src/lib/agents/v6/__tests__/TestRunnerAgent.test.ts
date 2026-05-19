import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestRunnerAgent } from "../verify/TestRunnerAgent";
import type { AgentContextV6 } from "../BaseAgent";

vi.mock("../WorktreeRunner", () => {
  const mockRun = vi.fn();
  return {
    WorktreeRunner: class MockRunner {
      run = mockRun;
    },
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

describe("TestRunnerAgent", () => {
  beforeEach(() => { mockRun.mockReset(); });

  it("reports passing tests from vitest output", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true,
      stdout: " Test Files  10 passed (10)\n      Tests  42 passed (42)\n",
      stderr: "", durationMs: 3000, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    const result = await agent.execute({}, makeCtx());
    expect(result.output!.passed).toBe(true);
    expect(result.output!.files).toBe(10);
    expect(result.output!.tests).toBe(42);
    expect(result.output!.failed).toBe(0);
  });

  it("reports failing tests", async () => {
    mockRun.mockResolvedValue({
      exitCode: 1, success: false,
      stdout: "      Tests  3 failed | 39 passed (42)\n Test Files  1 failed | 9 passed (10)\n",
      stderr: "", durationMs: 5000, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    const result = await agent.execute({}, makeCtx());
    expect(result.output!.passed).toBe(false);
    expect(result.output!.failed).toBe(3);
  });

  it("passes filter argument to vitest", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 500, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    await agent.execute({ filter: "src/lib/__tests__" }, makeCtx());
    const args = mockRun.mock.calls[0][2]; // args array
    expect(args).toContain("src/lib/__tests__");
  });

  it("uses worktree path when provided", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 100, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    await agent.execute({}, makeCtx({ worktreePath: "/tmp/wt" }));
    const handle = mockRun.mock.calls[0][0];
    expect(handle.path).toBe("/tmp/wt");
  });

  it("defaults to cwd when no worktree", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 100, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    await agent.execute({}, makeCtx());
    const handle = mockRun.mock.calls[0][0];
    expect(handle.path).toBe(process.cwd());
  });

  it("uses custom reporter", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 100, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    await agent.execute({ reporter: "verbose" }, makeCtx());
    const args = mockRun.mock.calls[0][2];
    expect(args).toContain("verbose");
  });

  it("truncates stdout to 4KB", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true, stdout: "x".repeat(10000), stderr: "", durationMs: 100, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    const result = await agent.execute({}, makeCtx());
    expect(result.output!.stdout.length).toBeLessThanOrEqual(4096);
  });

  it("handles empty output gracefully", async () => {
    mockRun.mockResolvedValue({
      exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 0, timedOut: false,
    });
    const agent = new TestRunnerAgent("/repo");
    const result = await agent.execute({}, makeCtx());
    expect(result.output!.files).toBe(0);
    expect(result.output!.tests).toBe(0);
  });
});
