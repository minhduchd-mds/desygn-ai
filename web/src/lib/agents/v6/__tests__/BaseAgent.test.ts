import { describe, it, expect, vi } from "vitest";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

class StubAgent extends BaseAgentV6<{ value: number }, { doubled: number }> {
  readonly id = "stub.test";
  readonly name = "Stub";
  readonly fleet: FleetName = "audit";
  readonly role = "analyzer" as const;
  readonly description = "Test stub";

  protected async run(input: { value: number }) {
    if (input.value < 0) throw new Error("negative");
    return { output: { doubled: input.value * 2 }, costUsd: 0.001 };
  }
}

function makeCtx(): AgentContextV6 {
  return {
    runId: "test-run",
    projectId: "test",
    costBudgetUsd: 1,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe("BaseAgentV6", () => {
  it("wraps successful execution in AgentResultV6", async () => {
    const agent = new StubAgent();
    const result = await agent.execute({ value: 5 }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ doubled: 10 });
    expect(result.costUsd).toBe(0.001);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("captures thrown errors into AgentResultV6.error", async () => {
    const agent = new StubAgent();
    const result = await agent.execute({ value: -1 }, makeCtx());
    expect(result.success).toBe(false);
    expect(result.error).toBe("negative");
    expect(result.output).toBeUndefined();
  });

  it("defaults estimateCost to 0", () => {
    const agent = new StubAgent();
    expect(agent.estimateCost({ value: 5 })).toBe(0);
  });

  it("defaults canRunInWorktree to false", () => {
    const agent = new StubAgent();
    expect(agent.canRunInWorktree()).toBe(false);
  });

  it("calls logger.info on start", async () => {
    const agent = new StubAgent();
    const ctx = makeCtx();
    await agent.execute({ value: 5 }, ctx);
    expect(ctx.logger.info).toHaveBeenCalled();
  });

  it("calls logger.error on failure", async () => {
    const agent = new StubAgent();
    const ctx = makeCtx();
    await agent.execute({ value: -1 }, ctx);
    expect(ctx.logger.error).toHaveBeenCalled();
  });
});
