import { describe, it, expect, vi } from "vitest";
import { OrchestratorAgentV6 } from "../OrchestratorAgent";
import { BaseAgentV6, type FleetName } from "../BaseAgent";

class StubAgent extends BaseAgentV6<{ ok: boolean }, { value: string }> {
  constructor(
    readonly id: string,
    readonly fleet: FleetName,
    private readonly cost = 0,
    private readonly shouldFail = false,
  ) {
    super();
  }
  readonly name = this.id;
  readonly role = "analyzer" as const;
  readonly description = "stub";

  estimateCost(): number {
    return this.cost;
  }

  protected async run() {
    if (this.shouldFail) throw new Error("forced failure");
    return { output: { value: this.id }, costUsd: this.cost };
  }
}

function makeCtx() {
  return {
    runId: "r1",
    projectId: "p1",
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe("OrchestratorAgentV6", () => {
  describe("registration", () => {
    it("registers agents", () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("a1", "audit"));
      expect(o.size()).toBe(1);
    });

    it("throws on duplicate id", () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("dup", "audit"));
      expect(() => o.register(new StubAgent("dup", "audit"))).toThrow(/already registered/);
    });

    it("registerAll bulk-adds", () => {
      const o = new OrchestratorAgentV6();
      o.registerAll([new StubAgent("a", "audit"), new StubAgent("b", "verify")]);
      expect(o.size()).toBe(2);
    });

    it("getFleet filters by fleet", () => {
      const o = new OrchestratorAgentV6();
      o.registerAll([
        new StubAgent("audit-1", "audit"),
        new StubAgent("audit-2", "audit"),
        new StubAgent("verify-1", "verify"),
      ]);
      expect(o.getFleet("audit").map((a) => a.id)).toEqual(["audit-1", "audit-2"]);
      expect(o.getFleet("verify").map((a) => a.id)).toEqual(["verify-1"]);
    });
  });

  describe("run()", () => {
    it("runs only fleets with input present", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("audit-only", "audit"));
      o.register(new StubAgent("verify-only", "verify"));

      const result = await o.run(
        { fleetInputs: { audit: { ok: true } }, maxCostUsd: 1 },
        makeCtx(),
      );
      expect(result.agentResults.has("audit-only")).toBe(true);
      expect(result.agentResults.has("verify-only")).toBe(false);
    });

    it("aggregates cost from all agents", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("a", "audit", 0.1));
      o.register(new StubAgent("b", "audit", 0.2));
      const result = await o.run(
        { fleetInputs: { audit: { ok: true } }, maxCostUsd: 1 },
        makeCtx(),
      );
      expect(result.totalCostUsd).toBeCloseTo(0.3, 5);
    });

    it("skips agents that exceed remaining budget", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("cheap", "audit", 0.1));
      o.register(new StubAgent("expensive", "audit", 5));
      const result = await o.run(
        { fleetInputs: { audit: { ok: true } }, maxCostUsd: 1 },
        makeCtx(),
      );
      expect(result.skippedAgentIds).toContain("expensive");
      expect(result.agentResults.has("cheap")).toBe(true);
      expect(result.counts.skipped).toBe(1);
    });

    it("marks allSucceeded=true when no agents failed or skipped", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("a", "audit"));
      const result = await o.run(
        { fleetInputs: { audit: { ok: true } }, maxCostUsd: 1 },
        makeCtx(),
      );
      expect(result.allSucceeded).toBe(true);
    });

    it("marks allSucceeded=false when an agent failed", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("a", "audit", 0, true));
      const result = await o.run(
        { fleetInputs: { audit: { ok: true } }, maxCostUsd: 1 },
        makeCtx(),
      );
      expect(result.allSucceeded).toBe(false);
      expect(result.counts.failed).toBe(1);
    });

    it("supports sequential fleet execution", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("a", "audit"));
      o.register(new StubAgent("b", "verify"));
      const result = await o.run(
        {
          fleetInputs: { audit: { ok: true }, verify: { ok: true } },
          maxCostUsd: 1,
          parallelFleets: false,
        },
        makeCtx(),
      );
      expect(result.agentResults.size).toBe(2);
    });

    it("respects agentIds filter", async () => {
      const o = new OrchestratorAgentV6();
      o.register(new StubAgent("a", "audit"));
      o.register(new StubAgent("b", "audit"));
      const result = await o.run(
        {
          fleetInputs: { audit: { ok: true } },
          maxCostUsd: 1,
          agentIds: ["a"],
        },
        makeCtx(),
      );
      expect(result.agentResults.has("a")).toBe(true);
      expect(result.agentResults.has("b")).toBe(false);
    });
  });
});
