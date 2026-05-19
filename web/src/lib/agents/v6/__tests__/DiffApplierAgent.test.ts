import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiffApplierAgent } from "../fix/DiffApplierAgent";
import type { AgentContextV6 } from "../BaseAgent";

vi.mock("../WorktreeRunner", () => {
  const mockApplyDiff = vi.fn();
  return {
    WorktreeRunner: class MockRunner { applyDiff = mockApplyDiff; },
    __mockApplyDiff: mockApplyDiff,
  };
});

const { __mockApplyDiff: mockApplyDiff } = await import("../WorktreeRunner") as unknown as { __mockApplyDiff: ReturnType<typeof vi.fn> };

function makeCtx(overrides: Partial<AgentContextV6> = {}): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    worktreePath: "/tmp/wt",
    ...overrides,
  };
}

describe("DiffApplierAgent", () => {
  beforeEach(() => { mockApplyDiff.mockReset(); });

  it("applies a diff successfully", async () => {
    mockApplyDiff.mockResolvedValue({ exitCode: 0, success: true, stdout: "", stderr: "", durationMs: 50, timedOut: false });
    const result = await new DiffApplierAgent("/repo").execute({ diff: "-old\n+new\n" }, makeCtx());
    expect(result.output!.applied).toBe(true);
  });

  it("reports failure when git apply fails", async () => {
    mockApplyDiff.mockResolvedValue({ exitCode: 1, success: false, stdout: "", stderr: "patch does not apply", durationMs: 30, timedOut: false });
    const result = await new DiffApplierAgent("/repo").execute({ diff: "bad" }, makeCtx());
    expect(result.output!.applied).toBe(false);
  });

  it("throws when no worktreePath", async () => {
    const result = await new DiffApplierAgent("/repo").execute({ diff: "x" }, makeCtx({ worktreePath: undefined }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("worktreePath");
  });

  it("canRunInWorktree returns true", () => {
    expect(new DiffApplierAgent("/repo").canRunInWorktree()).toBe(true);
  });

  it("truncates large output", async () => {
    mockApplyDiff.mockResolvedValue({ exitCode: 0, success: true, stdout: "x".repeat(5000), stderr: "y".repeat(5000), durationMs: 10, timedOut: false });
    const result = await new DiffApplierAgent("/repo").execute({ diff: "+c\n" }, makeCtx());
    expect(result.output!.stdout.length).toBeLessThanOrEqual(2048);
    expect(result.output!.stderr.length).toBeLessThanOrEqual(2048);
  });
});
