import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuildVerifierAgent } from "../verify/BuildVerifierAgent";
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

describe("BuildVerifierAgent", () => {
  beforeEach(() => { mockRun.mockReset(); });

  it("passes when both typecheck and build succeed", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 1000, timedOut: false });
    const result = await new BuildVerifierAgent("/repo").execute({}, makeCtx());
    expect(result.output!.passed).toBe(true);
    expect(result.output!.typecheck.passed).toBe(true);
    expect(result.output!.build.passed).toBe(true);
  });

  it("fails when typecheck fails", async () => {
    mockRun
      .mockResolvedValueOnce({ exitCode: 1, success: false, stdout: "error TS2322", stderr: "", durationMs: 500, timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 500, timedOut: false });
    const result = await new BuildVerifierAgent("/repo").execute({}, makeCtx());
    expect(result.output!.passed).toBe(false);
    expect(result.output!.typecheck.passed).toBe(false);
  });

  it("fails when build fails", async () => {
    mockRun
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 500, timedOut: false })
      .mockResolvedValueOnce({ exitCode: 1, success: false, stdout: "BUILD FAILED", stderr: "", durationMs: 500, timedOut: false });
    const result = await new BuildVerifierAgent("/repo").execute({}, makeCtx());
    expect(result.output!.passed).toBe(false);
    expect(result.output!.build.passed).toBe(false);
  });

  it("skips typecheck when requested", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 500, timedOut: false });
    const result = await new BuildVerifierAgent("/repo").execute({ skipTypecheck: true }, makeCtx());
    expect(result.output!.typecheck.output).toContain("skipped");
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("skips build when requested", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 500, timedOut: false });
    const result = await new BuildVerifierAgent("/repo").execute({ skipBuild: true }, makeCtx());
    expect(result.output!.build.output).toContain("skipped");
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("uses custom build script", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 500, timedOut: false });
    await new BuildVerifierAgent("/repo").execute({ skipTypecheck: true, buildScript: "build:prod" }, makeCtx());
    expect(mockRun.mock.calls[0][2]).toContain("build:prod");
  });

  it("uses worktree path", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "ok", stderr: "", durationMs: 100, timedOut: false });
    await new BuildVerifierAgent("/repo").execute({}, makeCtx({ worktreePath: "/tmp/wt" }));
    expect(mockRun.mock.calls[0][0].path).toBe("/tmp/wt");
  });
});
