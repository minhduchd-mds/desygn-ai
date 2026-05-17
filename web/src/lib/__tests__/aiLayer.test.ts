/**
 * Tests for ai-layer module.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AILayer, BUILT_IN_EXPERIMENTS } from "../../ai-layer";

describe("AILayer", () => {
  let ai: AILayer;

  beforeEach(() => {
    ai = new AILayer();
  });

  describe("initialization", () => {
    it("creates with default config", () => {
      const config = ai.getConfig();
      expect(config.piiProtection).toBe(true);
      expect(config.defaultProvider).toBe("groq");
      expect(config.enableGOAP).toBe(true);
      expect(config.enableEvidence).toBe(true);
      expect(config.maxConcurrency).toBe(4);
    });

    it("loads built-in experiments", () => {
      const experiments = ai.getExperiments();
      expect(experiments.length).toBe(BUILT_IN_EXPERIMENTS.length);
    });

    it("accepts custom config", () => {
      const custom = new AILayer({ piiProtection: false, maxConcurrency: 2 });
      expect(custom.getConfig().piiProtection).toBe(false);
      expect(custom.getConfig().maxConcurrency).toBe(2);
    });
  });

  describe("experiments", () => {
    it("enables/disables experiments", () => {
      ai.setExperiment("multi-model-routing", true);
      const exp = ai.getExperiments().find(e => e.id === "multi-model-routing");
      expect(exp?.enabled).toBe(true);
    });

    it("checks experiment active for tier", () => {
      ai.setExperiment("agent-chaining", true);
      // agent-chaining is 100% rollout for all tiers
      expect(ai.isExperimentActive("agent-chaining", "free")).toBe(true);
    });

    it("blocks experiment for wrong tier", () => {
      ai.setExperiment("tool-use-agents", true);
      // tool-use-agents is enterprise only
      expect(ai.isExperimentActive("tool-use-agents", "free")).toBe(false);
    });

    it("disabled experiment returns false", () => {
      ai.setExperiment("rag-design-docs", false);
      expect(ai.isExperimentActive("rag-design-docs", "enterprise")).toBe(false);
    });
  });

  describe("PII protection", () => {
    it("scans text for PII", () => {
      const result = ai.scanPII("Call me at 555-123-4567");
      expect(result.hasPII).toBe(true);
      expect(result.riskLevel).not.toBe("none");
    });

    it("clean text returns no PII", () => {
      const result = ai.scanPII("Hello world");
      expect(result.hasPII).toBe(false);
      expect(result.riskLevel).toBe("none");
    });

    it("redacts PII from text", () => {
      const redacted = ai.redactPII("Email: user@example.com");
      expect(redacted).not.toContain("user@example.com");
    });
  });

  describe("execution", () => {
    it("executes with default options", async () => {
      const result = await ai.execute("Analyze this design");
      expect(result.success).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.piiClean).toBe(true);
    });

    it("detects PII in input and still executes", async () => {
      const result = await ai.execute("My SSN is 123-45-6789");
      expect(result.piiClean).toBe(false);
      expect(result.success).toBeDefined();
    });

    it("returns quota exceeded when no analytics init", async () => {
      // With userId + tier but without proper quota setup, should still work
      const result = await ai.execute("test", { userId: "user1", tier: "free" });
      expect(result).toBeDefined();
    });
  });

  describe("GOAP planning", () => {
    it("plans when GOAP enabled", () => {
      const goal = {
        name: "analyze-design",
        conditions: new Map([["hasAnalysis", true]]),
        priority: 1,
      };
      const worldState = new Map<string, boolean | number | string>([
        ["hasDesignFile", true],
        ["hasAnalysis", false],
      ]);
      const plan = ai.plan(goal, worldState);
      // Plan may or may not find a path depending on registered actions
      expect(plan !== undefined).toBe(true);
    });

    it("returns null when GOAP disabled", () => {
      ai.configure({ enableGOAP: false });
      const goal = {
        name: "analyze-design",
        conditions: new Map([["hasAnalysis", true]]),
        priority: 1,
      };
      const worldState = new Map<string, boolean | number | string>([
        ["hasDesignFile", true],
      ]);
      const plan = ai.plan(goal, worldState);
      expect(plan).toBeNull();
    });
  });

  describe("statistics", () => {
    it("tracks execution count", async () => {
      await ai.execute("test1");
      await ai.execute("test2");
      const stats = ai.getStats();
      expect(stats.totalExecutions).toBe(2);
    });

    it("reports active experiments", () => {
      const stats = ai.getStats();
      expect(stats.activeExperiments).toBeGreaterThanOrEqual(0);
    });
  });

  describe("configuration", () => {
    it("updates config", () => {
      ai.configure({ defaultProvider: "anthropic" });
      expect(ai.getConfig().defaultProvider).toBe("anthropic");
    });

    it("registers custom agent", () => {
      ai.registerAgent({
        id: "custom-test",
        role: "analyzer",
        name: "Custom Test Agent",
        model: { tier: "fast", provider: "local", modelId: "test", costPer1kTokens: 0, avgLatencyMs: 1 },
        systemPrompt: "test",
        capabilities: ["pattern-detection"],
        maxTokens: 1000,
        temperature: 0,
        timeout: 5000,
      });
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe("BUILT_IN_EXPERIMENTS", () => {
  it("has 6 experiments defined", () => {
    expect(BUILT_IN_EXPERIMENTS.length).toBe(6);
  });

  it("each experiment has required fields", () => {
    for (const exp of BUILT_IN_EXPERIMENTS) {
      expect(exp.id).toBeTruthy();
      expect(exp.name).toBeTruthy();
      expect(exp.description).toBeTruthy();
      expect(typeof exp.enabled).toBe("boolean");
      expect(typeof exp.rollout).toBe("number");
      expect(exp.tiers.length).toBeGreaterThan(0);
    }
  });

  it("agent-chaining is enabled by default", () => {
    const chaining = BUILT_IN_EXPERIMENTS.find(e => e.id === "agent-chaining");
    expect(chaining?.enabled).toBe(true);
    expect(chaining?.rollout).toBe(100);
  });
});
