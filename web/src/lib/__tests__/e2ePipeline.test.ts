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

      expect(id).toBeTruthy();

      const results = await evidenceEngine.search("button padding", { limit: 5 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.record.content).toContain("Button");
    });

    it("usage analytics records pipeline activity", () => {
      analytics.track("pipeline_run", {
        inputType: "figma",
        framework: "react",
        success: true,
      });

      const stats = analytics.getStats();
      expect(stats.eventsTracked).toBeGreaterThan(0);
    });
  });
});
