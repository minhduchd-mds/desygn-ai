/**
 * Shannon Multi-Agent Engine tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DesignAgent,
  DesignOrchestrator,
  createOrchestrator,
  getDefaultAgentConfigs,
} from "../shannonEngine";
import type { AgentConfig, DesignPipelineContext } from "../shannonEngine";

describe("DesignAgent", () => {
  it("creates from built-in config ID", () => {
    const agent = new DesignAgent("design-analyzer");
    expect(agent.config.role).toBe("analyzer");
    expect(agent.config.model.provider).toBe("groq");
  });

  it("creates from custom config", () => {
    const config: AgentConfig = {
      id: "custom",
      role: "generator",
      name: "Custom",
      model: { tier: "fast", provider: "groq", modelId: "test", costPer1kTokens: 0, avgLatencyMs: 10 },
      systemPrompt: "test",
      capabilities: ["code-generation"],
      maxTokens: 1000,
      temperature: 0,
      timeout: 5000,
    };
    const agent = new DesignAgent(config);
    expect(agent.config.id).toBe("custom");
  });

  it("throws for unknown agent ID", () => {
    expect(() => new DesignAgent("nonexistent")).toThrow("Unknown agent");
  });

  it("executes and returns result", async () => {
    const agent = new DesignAgent("design-analyzer");
    const ctx: DesignPipelineContext = {
      pipelineId: "test",
      variables: new Map(),
      stepResults: new Map(),
      aborted: false,
      traceId: "trace-1",
      tokenBudget: 10000,
      tokensUsed: 0,
      agentResults: new Map(),
    };

    const result = await agent.execute({ name: "Button" }, ctx);
    expect(result.agentId).toBe("design-analyzer");
    expect(result.role).toBe("analyzer");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("uses memory when available", async () => {
    const agent = new DesignAgent("code-generator");
    const ctx: DesignPipelineContext = {
      pipelineId: "test",
      variables: new Map(),
      stepResults: new Map(),
      aborted: false,
      traceId: "trace-2",
      tokenBudget: 10000,
      tokensUsed: 0,
      agentResults: new Map(),
      queryMemory: () => [{ pattern: "flex-row", count: 5 }, { pattern: "card-shadow" }],
    };

    const result = await agent.execute({ name: "Card" }, ctx);
    expect(result.memoryHits).toBe(2);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("records messages", async () => {
    const agent = new DesignAgent("quality-validator");
    const ctx: DesignPipelineContext = {
      pipelineId: "test",
      variables: new Map(),
      stepResults: new Map(),
      aborted: false,
      traceId: "trace-3",
      tokenBudget: 10000,
      tokensUsed: 0,
      agentResults: new Map(),
    };

    await agent.execute("code here", ctx);
    const messages = agent.getMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe("result");
    expect(messages[0].from).toBe("quality-validator");
  });

  it("uses custom executeAgent when provided", async () => {
    const agent = new DesignAgent("design-analyzer");
    let calledWith = "";
    const ctx: DesignPipelineContext = {
      pipelineId: "test",
      variables: new Map(),
      stepResults: new Map(),
      aborted: false,
      traceId: "trace-4",
      tokenBudget: 10000,
      tokensUsed: 0,
      agentResults: new Map(),
      executeAgent: async (_config, prompt) => {
        calledWith = prompt;
        return { custom: true };
      },
    };

    const result = await agent.execute("test input", ctx);
    expect(calledWith).toContain("test input");
    expect((result.output as { custom: boolean }).custom).toBe(true);
  });
});

describe("DesignOrchestrator", () => {
  let orchestrator: DesignOrchestrator;

  beforeEach(() => {
    orchestrator = new DesignOrchestrator();
  });

  describe("agent registry", () => {
    it("has 4 default agents", () => {
      expect(orchestrator.getAgents().length).toBe(4);
    });

    it("gets agent by ID", () => {
      expect(orchestrator.getAgent("design-analyzer")).toBeDefined();
      expect(orchestrator.getAgent("code-generator")).toBeDefined();
      expect(orchestrator.getAgent("quality-validator")).toBeDefined();
      expect(orchestrator.getAgent("token-optimizer")).toBeDefined();
    });

    it("registers custom agent", () => {
      orchestrator.registerAgent({
        id: "custom-agent",
        role: "analyzer",
        name: "Custom",
        model: { tier: "fast", provider: "local", modelId: "local-7b", costPer1kTokens: 0, avgLatencyMs: 5 },
        systemPrompt: "test",
        capabilities: ["pattern-detection"],
        maxTokens: 2000,
        temperature: 0,
        timeout: 5000,
      });
      expect(orchestrator.getAgents().length).toBe(5);
    });
  });

  describe("planning", () => {
    it("plans simple pipeline (1 component, low complexity)", () => {
      const plan = orchestrator.plan({ components: 1, complexity: "low" });
      expect(plan.phases.length).toBeGreaterThanOrEqual(2); // analyze + validate at minimum
      expect(plan.estimatedTokens).toBeGreaterThan(0);
      expect(plan.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    });

    it("plans complex pipeline with token optimization", () => {
      const plan = orchestrator.plan({ components: 10, complexity: "high" });
      const phaseNames = plan.phases.map(p => p.name);
      expect(phaseNames).toContain("Token Optimization");
      expect(phaseNames).toContain("Quality Validation");
    });

    it("enables parallel generation for multiple components", () => {
      const plan = orchestrator.plan({ components: 5, complexity: "medium" });
      const genPhase = plan.phases.find(p => p.name === "Code Generation");
      expect(genPhase?.parallel).toBe(true);
    });

    it("sequential generation for single component", () => {
      const plan = orchestrator.plan({ components: 1, complexity: "medium" });
      const genPhase = plan.phases.find(p => p.name === "Code Generation");
      expect(genPhase?.parallel).toBe(false);
    });
  });

  describe("execution", () => {
    it("executes full pipeline", async () => {
      const result = await orchestrator.execute({ name: "Button", type: "COMPONENT" });
      expect(result.results.length).toBeGreaterThanOrEqual(3);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(result.output).toBeDefined();
    });

    it("respects token budget", async () => {
      const result = await orchestrator.execute({ name: "Card" }, { tokenBudget: 5000 });
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it("traces execution", async () => {
      const result = await orchestrator.execute({ name: "Nav" });
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].traceId).toContain("trace-");
    });

    it("includes all agent roles in results", async () => {
      const result = await orchestrator.execute({ name: "Hero" });
      const roles = result.results.map(r => r.role);
      expect(roles).toContain("analyzer");
      expect(roles).toContain("generator");
      expect(roles).toContain("validator");
    });

    it("uses memory integration", async () => {
      const result = await orchestrator.execute(
        { name: "Button" },
        { queryMemory: () => [{ pattern: "primary-btn" }] },
      );
      const withMemory = result.results.filter(r => r.memoryHits > 0);
      expect(withMemory.length).toBeGreaterThan(0);
    });

    it("handles high complexity with optimizer", async () => {
      const result = await orchestrator.execute(
        { name: "Dashboard" },
        { complexity: "high", components: 10 },
      );
      const roles = result.results.map(r => r.role);
      expect(roles).toContain("optimizer");
    });
  });
});

describe("Factory functions", () => {
  it("getDefaultAgentConfigs returns 4 configs", () => {
    const configs = getDefaultAgentConfigs();
    expect(Object.keys(configs).length).toBe(4);
  });

  it("createOrchestrator returns working instance", async () => {
    const orch = createOrchestrator();
    expect(orch.getAgents().length).toBe(4);
  });
});
