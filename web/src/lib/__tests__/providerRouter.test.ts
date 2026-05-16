/**
 * Provider Router tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ProviderRouter, createRouter, getModelRegistry } from "../providerRouter";

describe("ProviderRouter", () => {
  let router: ProviderRouter;

  beforeEach(() => {
    router = new ProviderRouter();
  });

  describe("routing", () => {
    it("routes validation to fast 8B model for free tier", () => {
      const decision = router.route({
        task: "validation",
        complexity: "low",
        userTier: "free",
        inputTokens: 2000,
      });
      expect(decision.model.id).toContain("8b");
      expect(decision.model.provider).toBe("groq");
    });

    it("routes code-gen to 70B for free tier", () => {
      const decision = router.route({
        task: "code-gen",
        complexity: "medium",
        userTier: "free",
        inputTokens: 4000,
      });
      expect(decision.model.id).toContain("70b");
      expect(decision.model.provider).toBe("groq");
    });

    it("routes code-gen to Claude for pro tier when preferred", () => {
      const decision = router.route({
        task: "code-gen",
        complexity: "high",
        userTier: "pro",
        inputTokens: 4000,
        preferredProvider: "anthropic",
      });
      expect(decision.model.provider).toBe("anthropic");
    });

    it("pro tier has access to Claude models", () => {
      const models = router.getAvailableModels("pro");
      expect(models.some(m => m.provider === "anthropic")).toBe(true);
    });

    it("routes chat to Groq for free tier", () => {
      const decision = router.route({
        task: "chat",
        complexity: "low",
        userTier: "free",
        inputTokens: 1000,
      });
      expect(decision.model.provider).toBe("groq");
    });

    it("respects preferred provider", () => {
      const decision = router.route({
        task: "code-gen",
        complexity: "medium",
        userTier: "pro",
        inputTokens: 4000,
        preferredProvider: "openai",
      });
      expect(decision.model.provider).toBe("openai");
    });

    it("includes fallback model", () => {
      const decision = router.route({
        task: "code-gen",
        complexity: "medium",
        userTier: "pro",
        inputTokens: 4000,
      });
      expect(decision.fallback).toBeDefined();
    });

    it("estimates cost", () => {
      const decision = router.route({
        task: "code-gen",
        complexity: "medium",
        userTier: "free",
        inputTokens: 4000,
        maxOutputTokens: 8000,
      });
      expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it("provides routing reason", () => {
      const decision = router.route({
        task: "validation",
        complexity: "low",
        userTier: "free",
        inputTokens: 1000,
      });
      expect(decision.reason.length).toBeGreaterThan(0);
    });
  });

  describe("convenience methods", () => {
    it("routeValidation returns fast model", () => {
      const decision = router.routeValidation();
      expect(decision.model.avgTTFTMs).toBeLessThanOrEqual(120);
    });

    it("routeCodeGen returns capable model", () => {
      const decision = router.routeCodeGen("pro", "high");
      expect(decision.model.capabilities).toContain("code-gen");
    });
  });

  describe("custom models", () => {
    it("registers custom model", () => {
      router.registerModel({
        id: "ollama-llama3",
        name: "Ollama Llama 3",
        provider: "local",
        contextWindow: 8192,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        avgTTFTMs: 200,
        avgThroughput: 50,
        capabilities: ["chat", "code-gen"],
        tier: "free",
      });

      const models = router.getAvailableModels("free");
      expect(models.find(m => m.id === "ollama-llama3")).toBeDefined();
    });
  });

  describe("statistics", () => {
    it("tracks routing stats", () => {
      router.route({ task: "validation", complexity: "low", userTier: "free", inputTokens: 1000 });
      router.route({ task: "code-gen", complexity: "medium", userTier: "free", inputTokens: 4000 });

      const stats = router.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.byProvider["groq"]).toBe(2);
    });

    it("resets stats", () => {
      router.route({ task: "chat", complexity: "low", userTier: "free", inputTokens: 500 });
      router.resetStats();
      expect(router.getStats().totalRequests).toBe(0);
    });
  });

  describe("model registry", () => {
    it("returns available models by tier", () => {
      const freeModels = router.getAvailableModels("free");
      const proModels = router.getAvailableModels("pro");
      expect(proModels.length).toBeGreaterThan(freeModels.length);
    });

    it("free tier only gets Groq models", () => {
      const freeModels = router.getAvailableModels("free");
      expect(freeModels.every(m => m.provider === "groq")).toBe(true);
    });

    it("pro tier includes Anthropic and OpenAI", () => {
      const proModels = router.getAvailableModels("pro");
      expect(proModels.some(m => m.provider === "anthropic")).toBe(true);
      expect(proModels.some(m => m.provider === "openai")).toBe(true);
    });
  });

  describe("cost estimation", () => {
    it("estimates zero cost for free models", () => {
      const model = router.getAvailableModels("free").find(m => m.id === "llama-3.1-8b-instant")!;
      const cost = router.estimateCost(model, 1000, 1000);
      expect(cost).toBeLessThan(0.001);
    });

    it("estimates higher cost for premium models", () => {
      const models = router.getAvailableModels("pro");
      const claude = models.find(m => m.id.includes("sonnet"))!;
      const groq = models.find(m => m.id.includes("8b"))!;
      const claudeCost = router.estimateCost(claude, 4000, 8000);
      const groqCost = router.estimateCost(groq, 4000, 8000);
      expect(claudeCost).toBeGreaterThan(groqCost);
    });
  });
});

describe("Factory functions", () => {
  it("createRouter returns working instance", () => {
    const router = createRouter();
    expect(router.getAvailableModels("free").length).toBeGreaterThan(0);
  });

  it("getModelRegistry returns all models", () => {
    const models = getModelRegistry();
    expect(models.length).toBeGreaterThanOrEqual(6);
  });
});
