import { describe, it, expect, vi } from "vitest";
import { RegressionGuardAgent } from "../safety/RegressionGuardAgent";
import type { AgentContextV6 } from "../BaseAgent";

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

// Mock child_process.spawn to auto-resolve with exit code 0
vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    spawn: vi.fn().mockImplementation(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      process.nextTick(() => child.emit("close", 0));
      return child;
    }),
  };
});

describe("RegressionGuardAgent", () => {
  it("has correct agent metadata", () => {
    const agent = new RegressionGuardAgent();
    expect(agent.id).toBe("safety.regression-guard");
    expect(agent.fleet).toBe("safety");
    expect(agent.name).toBe("Regression Guard");
  });

  it("passes when all 3 checks succeed", async () => {
    const result = await new RegressionGuardAgent().execute({ cwd: "/tmp" }, makeCtx());
    expect(result.output!.passed).toBe(true);
    expect(result.output!.checks).toHaveLength(3);
    expect(result.output!.checks.every((c) => c.passed)).toBe(true);
  });

  it("check names are lint, build, test", async () => {
    const result = await new RegressionGuardAgent().execute({ cwd: "/tmp" }, makeCtx());
    const names = result.output!.checks.map((c) => c.name);
    expect(names).toEqual(["lint", "build", "test"]);
  });

  it("skips specified checks", async () => {
    const result = await new RegressionGuardAgent().execute(
      { cwd: "/tmp", skip: ["lint", "test"] },
      makeCtx(),
    );
    expect(result.output!.checks).toHaveLength(1);
    expect(result.output!.checks[0].name).toBe("build");
  });

  it("records latency per check", async () => {
    const result = await new RegressionGuardAgent().execute({ cwd: "/tmp" }, makeCtx());
    for (const check of result.output!.checks) {
      expect(check.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports total duration", async () => {
    const result = await new RegressionGuardAgent().execute({ cwd: "/tmp" }, makeCtx());
    expect(result.output!.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("failedAt is null when all pass", async () => {
    const result = await new RegressionGuardAgent().execute({ cwd: "/tmp" }, makeCtx());
    expect(result.output!.failedAt).toBeNull();
  });
});
