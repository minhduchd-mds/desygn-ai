/**
 * AI Pipeline orchestration tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PipelineRunner,
  createDesignToCodePipeline,
  createBatchGenerationPipeline,
} from "../aiPipeline";
import type { PipelineDefinition, PipelineEvent } from "../aiPipeline";

describe("PipelineRunner", () => {
  let runner: PipelineRunner;

  beforeEach(() => {
    runner = new PipelineRunner();
  });

  describe("basic execution", () => {
    it("executes a simple pipeline", async () => {
      const pipeline: PipelineDefinition = {
        id: "test-1",
        name: "Test",
        steps: [
          { id: "step-1", name: "Double", execute: (input: unknown) => (input as number) * 2 },
          { id: "step-2", name: "Add 10", execute: (input: unknown) => (input as number) + 10 },
        ],
      };

      const result = await runner.execute(pipeline, 5);
      expect(result.status).toBe("completed");
      expect(result.output).toBe(20); // 5 * 2 + 10
      expect(result.steps.length).toBe(2);
    });

    it("passes output between steps", async () => {
      const pipeline: PipelineDefinition = {
        id: "chain",
        name: "Chain",
        steps: [
          { id: "s1", name: "Create", execute: () => ({ name: "Button" }) },
          { id: "s2", name: "Transform", execute: (input: unknown) => ({ ...(input as object), processed: true }) },
        ],
      };

      const result = await runner.execute(pipeline);
      expect((result.output as { name: string; processed: boolean }).processed).toBe(true);
    });

    it("tracks step durations", async () => {
      const pipeline: PipelineDefinition = {
        id: "timed",
        name: "Timed",
        steps: [
          { id: "s1", name: "Fast", execute: () => "done" },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.steps[0].duration).toBeGreaterThanOrEqual(0);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it("reports attempts count", async () => {
      const pipeline: PipelineDefinition = {
        id: "attempts",
        name: "Attempts",
        steps: [
          { id: "s1", name: "Once", execute: () => "ok" },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.steps[0].attempts).toBe(1);
    });
  });

  describe("conditional execution", () => {
    it("skips step when shouldRun returns false", async () => {
      const pipeline: PipelineDefinition = {
        id: "conditional",
        name: "Conditional",
        steps: [
          { id: "s1", name: "Init", execute: () => ({ valid: false }) },
          {
            id: "s2",
            name: "Only if valid",
            shouldRun: (input: unknown) => (input as { valid: boolean }).valid,
            execute: () => "should not run",
          },
          { id: "s3", name: "Final", execute: (input: unknown) => input },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.steps[1].status).toBe("skipped");
      // Step 3 receives step 1's output since step 2 was skipped
      expect((result.output as { valid: boolean }).valid).toBe(false);
    });

    it("runs step when shouldRun returns true", async () => {
      const pipeline: PipelineDefinition = {
        id: "run-cond",
        name: "Run Cond",
        steps: [
          { id: "s1", name: "Init", execute: () => ({ ready: true }) },
          {
            id: "s2",
            name: "When ready",
            shouldRun: (input: unknown) => (input as { ready: boolean }).ready,
            execute: () => "ran successfully",
          },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.steps[1].status).toBe("completed");
      expect(result.output).toBe("ran successfully");
    });
  });

  describe("error handling", () => {
    it("fails pipeline on step error (abort policy)", async () => {
      const pipeline: PipelineDefinition = {
        id: "fail-abort",
        name: "Fail Abort",
        onError: "abort",
        steps: [
          { id: "s1", name: "OK", execute: () => "fine" },
          { id: "s2", name: "Fail", execute: () => { throw new Error("boom"); } },
          { id: "s3", name: "Never", execute: () => "unreachable" },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.status).toBe("failed");
      expect(result.steps[1].status).toBe("failed");
      expect(result.steps[1].error).toBe("boom");
      expect(result.steps[2].status).toBe("skipped");
    });

    it("continues on error with skip policy", async () => {
      const pipeline: PipelineDefinition = {
        id: "fail-skip",
        name: "Fail Skip",
        onError: "skip",
        steps: [
          { id: "s1", name: "First", execute: () => "first-output" },
          { id: "s2", name: "Fail", execute: () => { throw new Error("oops"); } },
          { id: "s3", name: "Continue", execute: (input: unknown) => input },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.status).toBe("partial");
      expect(result.steps[2].status).toBe("completed");
      // Step 3 receives step 1 output because step 2 failed (skip policy)
      expect(result.output).toBe("first-output");
    });

    it("retries failed steps", async () => {
      let attempts = 0;
      const pipeline: PipelineDefinition = {
        id: "retry",
        name: "Retry",
        steps: [
          {
            id: "s1",
            name: "Flaky",
            retry: { maxAttempts: 3, delayMs: 10 },
            execute: () => {
              attempts++;
              if (attempts < 3) throw new Error("not yet");
              return "success";
            },
          },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.status).toBe("completed");
      expect(result.steps[0].attempts).toBe(3);
      expect(result.output).toBe("success");
    });

    it("times out long steps", async () => {
      const pipeline: PipelineDefinition = {
        id: "timeout",
        name: "Timeout",
        steps: [
          {
            id: "s1",
            name: "Slow",
            timeout: 50,
            execute: () => new Promise(resolve => setTimeout(resolve, 200)),
          },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.steps[0].status).toBe("failed");
      expect(result.steps[0].error).toContain("timed out");
    });
  });

  describe("rollback", () => {
    it("rolls back completed steps on failure", async () => {
      const rolledBack: string[] = [];

      const pipeline: PipelineDefinition = {
        id: "rollback",
        name: "Rollback",
        onError: "abort",
        steps: [
          {
            id: "s1",
            name: "Create",
            execute: () => "created",
            rollback: () => { rolledBack.push("s1"); },
          },
          {
            id: "s2",
            name: "Fail",
            execute: () => { throw new Error("fail"); },
          },
        ],
      };

      await runner.execute(pipeline);
      expect(rolledBack).toContain("s1");
    });
  });

  describe("events", () => {
    it("emits pipeline lifecycle events", async () => {
      const events: PipelineEvent[] = [];
      runner.on(e => events.push(e));

      const pipeline: PipelineDefinition = {
        id: "events",
        name: "Events",
        steps: [
          { id: "s1", name: "Step", execute: () => "done" },
        ],
      };

      await runner.execute(pipeline);
      const types = events.map(e => e.type);
      expect(types).toContain("pipeline:start");
      expect(types).toContain("step:start");
      expect(types).toContain("step:complete");
      expect(types).toContain("pipeline:complete");
    });

    it("emits step:skip for skipped steps", async () => {
      const events: PipelineEvent[] = [];
      runner.on(e => events.push(e));

      const pipeline: PipelineDefinition = {
        id: "skip-event",
        name: "Skip",
        steps: [
          { id: "s1", name: "Skip", shouldRun: () => false, execute: () => "nope" },
        ],
      };

      await runner.execute(pipeline, null);
      expect(events.some(e => e.type === "step:skip")).toBe(true);
    });

    it("allows unsubscribing", async () => {
      const events: PipelineEvent[] = [];
      const unsub = runner.on(e => events.push(e));
      unsub();

      const pipeline: PipelineDefinition = {
        id: "unsub",
        name: "Unsub",
        steps: [{ id: "s1", name: "S", execute: () => null }],
      };

      await runner.execute(pipeline);
      expect(events.length).toBe(0);
    });
  });

  describe("abort", () => {
    it("aborts a running pipeline", async () => {
      const pipeline: PipelineDefinition = {
        id: "abortable",
        name: "Abortable",
        steps: [
          {
            id: "s1",
            name: "Slow",
            execute: async (_input, context) => {
              // Simulate aborting mid-execution
              runner.abort(context.pipelineId);
              return "done";
            },
          },
          { id: "s2", name: "After", execute: () => "should skip" },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.steps[1].status).toBe("skipped");
    });

    it("reports running state", async () => {
      let running = false;
      const pipeline: PipelineDefinition = {
        id: "running-check",
        name: "Running",
        steps: [
          {
            id: "s1", name: "Check",
            execute: () => { running = runner.isRunning("running-check"); return null; },
          },
        ],
      };

      await runner.execute(pipeline);
      expect(running).toBe(true);
      expect(runner.isRunning("running-check")).toBe(false);
    });
  });

  describe("context variables", () => {
    it("shares variables between steps via context", async () => {
      const pipeline: PipelineDefinition = {
        id: "context-vars",
        name: "Context",
        steps: [
          {
            id: "s1", name: "Set",
            execute: (_input, ctx) => { ctx.variables.set("key", "value"); return null; },
          },
          {
            id: "s2", name: "Get",
            execute: (_input, ctx) => ctx.variables.get("key"),
          },
        ],
      };

      const result = await runner.execute(pipeline);
      expect(result.output).toBe("value");
    });
  });
});

describe("Pre-built Pipelines", () => {
  let runner: PipelineRunner;

  beforeEach(() => {
    runner = new PipelineRunner();
  });

  it("design-to-code pipeline executes successfully", async () => {
    const pipeline = createDesignToCodePipeline();
    const result = await runner.execute(pipeline, { name: "Card", type: "COMPONENT", children: [1, 2, 3] });
    expect(result.status).toBe("completed");
    expect((result.output as { optimized: boolean }).optimized).toBe(true);
  });

  it("batch generation pipeline executes", async () => {
    const pipeline = createBatchGenerationPipeline();
    const result = await runner.execute(pipeline, [{ name: "Button" }, { name: "Card" }]);
    expect(result.status).toBe("completed");
    expect((result.output as { components: number }).components).toBe(2);
  });
});
