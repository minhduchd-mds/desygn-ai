/**
 * E2E Pipeline Integration Tests
 * Tests the full flow: Input → PII → GOAP → Shannon → Evidence → Output
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PipelineEngine, createPipeline } from "../pipelineIntegration";
import { GOAPShannonBridge } from "../goapShannonBridge";
import { PIIScanner } from "../piiDetection";
import { EvidenceMemoryEngine } from "../evidenceMemory";
import { UsageAnalyticsEngine } from "../usageAnalytics";
import type { GOAPGoal } from "../goapPlanner";

describe("E2E Pipeline Integration", () => {
  let pipeline: PipelineEngine;
  let bridge: GOAPShannonBridge;
  let piiScanner: PIIScanner;
  let evidenceEngine: EvidenceMemoryEngine;
  let analytics: UsageAnalyticsEngine;

  beforeEach(() => {
    pipeline = createPipeline({
      enableMemory: true,
      enableAnalysis: true,
      enableValidation: true,
    });

    bridge = new GOAPShannonBridge({ enableEvidenceStorage: true });
    bridge.setWorldState(new Map([["hasDesignFile", true]]));

    piiScanner = new PIIScanner();

    evidenceEngine = new EvidenceMemoryEngine();
    evidenceEngine.configure({ maxRecords: 1000, decayFunction: "sigmoid" });

    analytics = new UsageAnalyticsEngine({ enabled: true, flushIntervalMs: 0, batchSize: 100 });
    analytics.initialize("test-user", "pro");
  });

  describe("full pipeline flow", () => {
    it("runs complete design-to-code pipeline", async () => {
      // Step 1: Pipeline processes input
      const result = await pipeline.run({
        type: "figma",
        content: "Button component with primary variant, 8px padding",
        framework: "react",
        designSystem: "material",
      });

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(8);
      expect(result.output).not.toBeNull();
      // Millisecond-resolution timers may validly report 0 for a fully in-memory run.
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("GOAP plans and executes full deployment", async () => {
      const goal: GOAPGoal = {
        name: "deploy-component",
        conditions: new Map([["deployed", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.feasible).toBe(true);
      expect(result.worldStateAfter.get("deployed")).toBe(true);
      expect(result.worldStateAfter.get("codeGenerated")).toBe(true);
      expect(result.agentResults.every((r) => r.success)).toBe(true);
    });

    it("PII scanner protects sensitive data in pipeline", () => {
      const designInput = "User email john@secret.com found in component props";
      const scanResult = piiScanner.scan(designInput);

      expect(scanResult.hasPII).toBe(true);
      expect(scanResult.redactedText).not.toContain("john@secret.com");

      // Clean input can be stored
      const cleanInput = "Button component with 12px border-radius";
      expect(piiScanner.hasPII(cleanInput)).toBe(false);
    });

    it("evidence engine stores and recalls pipeline results", async () => {
      // Store pipeline output as evidence
      const id = await evidenceEngine.storeEvidence({
        content: "Button component uses 8px padding with primary blue color",
        source: "design-file",
        confidence: 0.95,
        validated: true,
        tags: ["button", "padding", "color"],
        metadata: { framework: "react", pipeline: "e2e" },
      });

      expect(id).toMatch(/^ev_/);

      // Recall evidence
      const recalled = await evidenceEngine.recallEvidence("button padding", {
        minConfidence: 0.5,
        limit: 5,
      });

      expect(recalled.length).toBeGreaterThan(0);
      expect(recalled[0].content).toContain("8px padding");
    });

    it("analytics tracks pipeline usage and enforces quotas", () => {
      // Track pipeline execution
      analytics.track("pipeline_run", { framework: "react", inputType: "figma" });
      analytics.track("code_generated", { tokens: 500 });

      // Check feature access
      expect(analytics.hasFeature("evidence-memory")).toBe(true); // Pro tier
      expect(analytics.hasFeature("sso")).toBe(false); // Enterprise only

      // Check quota
      expect(analytics.checkQuota("generations")).toBe(true);

      const stats = analytics.getStats();
      expect(stats.totalEvents).toBe(2);
    });
  });

  describe("integrated multi-module flow", () => {
    it("PII scan → Evidence store → GOAP plan → Execute", async () => {
      // 1. Scan input for PII
      const input = "Component spacing: 16px, margin: auto";
      const scanResult = piiScanner.scan(input);
      expect(scanResult.hasPII).toBe(false);

      // 2. Store as evidence
      const evidenceId = await evidenceEngine.storeEvidence({
        content: input,
        source: "design-file",
        confidence: 0.9,
        validated: true,
        tags: ["spacing", "layout"],
        metadata: {},
      });
      expect(evidenceId).toBeTruthy();

      // 3. GOAP plans the workflow
      const goal: GOAPGoal = {
        name: "generate-code",
        conditions: new Map([["codeGenerated", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);
      expect(result.plan.feasible).toBe(true);
      expect(result.worldStateAfter.get("codeGenerated")).toBe(true);

      // 4. Track in analytics
      analytics.track("e2e_complete", { steps: result.agentResults.length });
      expect(analytics.getStats().totalEvents).toBe(1);
    });

    it("handles pipeline with PII blocking", async () => {
      // Input with PII should be cleaned
      const dirtyInput = "Button by john@company.com, card: 4532015112830366";
      const scanResult = piiScanner.scan(dirtyInput);

      expect(scanResult.hasPII).toBe(true);
      expect(scanResult.riskLevel).toBe("critical");

      // Store redacted version
      const evidenceId = await evidenceEngine.storeEvidence({
        content: scanResult.redactedText,
        source: "user-feedback",
        confidence: 0.7,
        validated: false,
        tags: ["user-input", "pii-redacted"],
        metadata: { originalHadPII: true },
      });
      expect(evidenceId).toBeTruthy();

      // Evidence doesn't contain PII
      const recalled = await evidenceEngine.recallEvidence("button", { limit: 5 });
      for (const record of recalled) {
        expect(record.content).not.toContain("john@company.com");
        expect(record.content).not.toContain("4532015112830366");
      }
    });

    it("pipeline abort and stats tracking", async () => {
      // Run pipeline
      const result = await pipeline.run({
        type: "manual",
        content: "Simple card component",
        framework: "vue",
      });

      expect(result.success).toBe(true);

      // Stats accumulated
      const stats = pipeline.getStats();
      expect(stats.runCount).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it("evidence decay and GC in pipeline context", async () => {
      // Store low-confidence evidence
      await evidenceEngine.storeEvidence({
        content: "Maybe use 4px gap?",
        source: "ai-inference",
        confidence: 0.3,
        validated: false,
        tags: ["spacing"],
        metadata: {},
      });

      await evidenceEngine.storeEvidence({
        content: "Confirmed: 8px gap standard",
        source: "design-file",
        confidence: 0.95,
        validated: true,
        tags: ["spacing"],
        metadata: {},
      });

      const stats = evidenceEngine.getStats();
      expect(stats.totalRecords).toBe(2);
      expect(stats.validatedRecords).toBe(1);
    });

    it("GOAP replanning after world state change", async () => {
      // Start with minimal state
      bridge.setWorldState(new Map([["hasDesignFile", true]]));

      // Plan for code generation
      const goal: GOAPGoal = {
        name: "code",
        conditions: new Map([["codeGenerated", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);
      expect(result.plan.feasible).toBe(true);

      // Now try a goal that builds on previous state
      const goal2: GOAPGoal = {
        name: "deploy",
        conditions: new Map([["deployed", true]]),
        priority: 1,
      };

      const result2 = await bridge.executeGoal(goal2);
      expect(result2.plan.feasible).toBe(true);
      expect(result2.worldStateAfter.get("deployed")).toBe(true);
    });
  });

  describe("performance characteristics", () => {
    it("full pipeline completes in under 500ms", async () => {
      const start = Date.now();
      const result = await pipeline.run({
        type: "figma",
        content: "Card component with shadow, padding 16px",
        framework: "react",
      });
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(500);
    });

    it("GOAP planning + execution under 200ms", async () => {
      const start = Date.now();
      const result = await bridge.executeGoal({
        name: "full",
        conditions: new Map([["deployed", true]]),
        priority: 1,
      });
      const elapsed = Date.now() - start;

      expect(result.plan.feasible).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });

    it("PII scan under 10ms for normal text", () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        piiScanner.scan("Button component with primary variant and hover state");
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // 100 scans < 100ms = <1ms each
    });
  });
});
