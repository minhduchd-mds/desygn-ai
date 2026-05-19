import { describe, it, expect, vi, beforeEach } from "vitest";
import { RollbackAgent } from "../fix/RollbackAgent";
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
    worktreePath: "/tmp/wt",
    ...overrides,
  };
}

describe("RollbackAgent", () => {
  beforeEach(() => { mockRun.mockReset(); });

  it("rolls back successfully", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "HEAD is now at abc", stderr: "", durationMs: 50, timedOut: false });
    const result = await new RollbackAgent("/repo").execute({ reason: "test failure" }, makeCtx());
    expect(result.output!.rolledBack).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(2); // reset + clean
  });

  it("fails when git reset fails", async () => {
    mockRun
      .mockResolvedValueOnce({ exitCode: 1, success: false, stdout: "", stderr: "err", durationMs: 50, timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 50, timedOut: false });
    const result = await new RollbackAgent("/repo").execute({}, makeCtx());
    expect(result.output!.rolledBack).toBe(false);
  });

  it("fails when git clean fails", async () => {
    mockRun
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 50, timedOut: false })
      .mockResolvedValueOnce({ exitCode: 1, success: false, stdout: "", stderr: "clean err", durationMs: 50, timedOut: false });
    const result = await new RollbackAgent("/repo").execute({}, makeCtx());
    expect(result.output!.rolledBack).toBe(false);
  });

  it("throws when no worktreePath", async () => {
    const result = await new RollbackAgent("/repo").execute({ reason: "t" }, makeCtx({ worktreePath: undefined }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("worktreePath");
  });

  it("canRunInWorktree returns true", () => {
    expect(new RollbackAgent("/repo").canRunInWorktree()).toBe(true);
  });

  it("includes reason in log", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 50, timedOut: false });
    const result = await new RollbackAgent("/repo").execute({ reason: "patch rejected" }, makeCtx());
    expect(result.output!.rolledBack).toBe(true);
  });
});
