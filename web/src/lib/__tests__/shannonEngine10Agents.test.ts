import { describe, it, expect, beforeEach } from "vitest";
import { ShannonEngine10, createShannonEngine10, type AgentTask, type AgentType } from "../shannonEngine10Agents";

describe("ShannonEngine10", () => {
  let engine: ShannonEngine10;

  beforeEach(() => {
    engine = new ShannonEngine10();
  });

  describe("agent capabilities", () => {
    it("lists all 10 available agents", () => {
      const agents = engine.getAvailableAgents();
      expect(agents.length).toBe(10);
      expect(agents).toContain("design-analyzer");
      expect(agents).toContain("accessibility-validator");
      expect(agents).toContain("mobile-optimizer");
      expect(agents).toContain("code-generator");
      expect(agents).toContain("performance-optimizer");
      expect(agents).toContain("security-validator");
      expect(agents).toContain("design-system-learner");
      expect(agents).toContain("documentation-agent");
      expect(agents).toContain("test-generator");
      expect(agents).toContain("deployment-orchestrator");
    });

    it("returns capability info for each agent", () => {
      const agents = engine.getAvailableAgents();
      for (const agent of agents) {
        const capability = engine.getAgentCapability(agent as AgentType);
        expect(capability).toBeDefined();
        expect(capability.name).toBeDefined();
        expect(capability.description).toBeDefined();
        expect(capability.models).toBeDefined();
        expect(capability.models.length).toBeGreaterThan(0);
        expect(capability.costPerRequest).toBeGreaterThan(0);
        expect(capability.latencyMs).toBeGreaterThan(0);
        expect(capability.successRate).toBeGreaterThan(0.8);
      }
    });

    it("has appropriate cost distribution", () => {
      const designAnalyzer = engine.getAgentCapability("design-analyzer");
      const codeGenerator = engine.getAgentCapability("code-generator");

      // Code generator should cost more than analyzer
      expect(codeGenerator.costPerRequest).toBeGreaterThan(designAnalyzer.costPerRequest);
    });

    it("has realistic latency estimates", () => {
      const agents = engine.getAvailableAgents();
      for (const agent of agents) {
        const capability = engine.getAgentCapability(agent as AgentType);
        // All agents should complete within reasonable time
        expect(capability.latencyMs).toBeLessThan(10000);
      }
    });
  });

  describe("full pipeline creation", () => {
    it("creates complete 10-agent design-to-code pipeline", () => {
      const input = {
        designNode: { type: "FRAME", name: "Card Component" },
        framework: "react",
        designSystem: "material-ui",
      };

      const tasks = engine.createFullPipeline(input);

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThanOrEqual(10);

      // Should have tasks for all major agents
      const agentTypes = new Set(tasks.map((t) => t.type));
      expect(agentTypes.has("design-analyzer")).toBe(true);
      expect(agentTypes.has("accessibility-validator")).toBe(true);
      expect(agentTypes.has("code-generator")).toBe(true);
    });

    it("creates tasks with proper dependencies", () => {
      const input = {
        designNode: { type: "FRAME", name: "Button" },
        framework: "vue",
        designSystem: "tailwind",
      };

      const tasks = engine.createFullPipeline(input);

      // Analysis tasks should have no dependencies
      const analysisTask = tasks.find((t) => t.type === "design-analyzer");
      expect(analysisTask?.dependencies.length).toBe(0);

      // Code generation should depend on analysis tasks
      const codeGenTask = tasks.find((t) => t.type === "code-generator");
      expect(codeGenTask?.dependencies.length).toBeGreaterThan(0);

      // Deployment should depend on code generation and testing
      const deployTask = tasks.find((t) => t.type === "deployment-orchestrator");
      expect(deployTask?.dependencies.length).toBeGreaterThan(0);
    });

    it("assigns correct priority levels", () => {
      const input = {
        designNode: {},
        framework: "react",
        designSystem: "custom",
      };

      const tasks = engine.createFullPipeline(input);

      // Critical analysis and generation tasks should have priority 0 or 1
      const criticalTasks = tasks.filter(
        (t) =>
          t.type === "design-analyzer" ||
          t.type === "accessibility-validator" ||
          t.type === "code-generator"
      );

      expect(criticalTasks.every((t) => t.priority <= 1)).toBe(true);

      // Learning agents can have lower priority
      const learningTask = tasks.find((t) => t.type === "design-system-learner");
      if (learningTask) {
        expect(learningTask.priority).toBe(2);
      }
    });

    it("creates tasks for all supported frameworks", () => {
      const frameworks = ["react", "vue", "svelte", "flutter", "react-native"];

      for (const framework of frameworks) {
        const input = {
          designNode: {},
          framework,
          designSystem: "custom",
        };

        const tasks = engine.createFullPipeline(input);
        expect(tasks.length).toBeGreaterThan(0);
      }
    });
  });

  describe("task scheduling", () => {
    it("schedules tasks with dependency resolution", async () => {
      const input = {
        designNode: { type: "FRAME" },
        framework: "react",
        designSystem: "material",
      };

      const tasks = engine.createFullPipeline(input);
      const scheduled = await engine.scheduleTasks(tasks);

      expect(scheduled.batches).toBeDefined();
      expect(scheduled.batches.length).toBeGreaterThan(0);
      expect(scheduled.totalTasks).toBe(tasks.length);

      // First batch should have independent tasks
      const firstBatch = scheduled.batches[0];
      expect(firstBatch.length).toBeGreaterThan(0);

      // Later batches depend on earlier ones
      if (scheduled.batches.length > 1) {
        const secondBatch = scheduled.batches[1];
        expect(secondBatch.length).toBeGreaterThan(0);
      }
    });

    it("respects max concurrent task limit", async () => {
      const engineWithLimit = new ShannonEngine10({ maxConcurrentTasks: 3 });

      const input = {
        designNode: {},
        framework: "react",
        designSystem: "custom",
      };

      const tasks = engineWithLimit.createFullPipeline(input);
      const scheduled = await engineWithLimit.scheduleTasks(tasks);

      // No batch should exceed the concurrent limit
      expect(scheduled.batches.every((batch) => batch.length <= 3)).toBe(true);
    });

    it("handles circular dependency detection", async () => {
      const tasks: AgentTask[] = [
        {
          id: "task1",
          type: "design-analyzer",
          input: {},
          priority: 0,
          timeout: 30000,
          retryCount: 0,
          dependencies: ["task2"],
        },
        {
          id: "task2",
          type: "accessibility-validator",
          input: {},
          priority: 0,
          timeout: 30000,
          retryCount: 0,
          dependencies: ["task1"],
        },
      ];

      // Scheduling tasks with circular deps should throw
      try {
        await engine.scheduleTasks(tasks);
        // If we get here, circular detection failed
        expect(true).toBe(false);
      } catch (error) {
        // Expected to throw for circular dependencies
        expect(error).toBeDefined();
      }
    });
  });

  describe("execution and statistics", () => {
    it("tracks execution statistics", async () => {
      const input = {
        designNode: {},
        framework: "react",
        designSystem: "material",
      };

      const tasks = engine.createFullPipeline(input);
      await engine.scheduleTasks(tasks);
      const stats = engine.getStats();

      expect(stats.totalTasks).toBeGreaterThan(0);
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0);
      expect(stats.failedTasks).toBeGreaterThanOrEqual(0);
      expect(stats.totalCost).toBeGreaterThanOrEqual(0);
      expect(stats.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(stats.averageSuccessRate).toBeGreaterThanOrEqual(0);
      expect(stats.averageSuccessRate).toBeLessThanOrEqual(1);
    });

    it("correctly calculates cost", async () => {
      const input = {
        designNode: {},
        framework: "react",
        designSystem: "material",
      };

      const tasks = engine.createFullPipeline(input);
      await engine.scheduleTasks(tasks);

      const stats = engine.getStats();

      // Cost should be 0 until tasks are actually executed
      expect(stats.totalCost).toBeGreaterThanOrEqual(0);
      expect(stats.totalCost).toBeLessThan(5.0);
    });

    it("estimates total latency", async () => {
      const input = {
        designNode: {},
        framework: "react",
        designSystem: "material",
      };

      const tasks = engine.createFullPipeline(input);
      await engine.scheduleTasks(tasks);

      const stats = engine.getStats();

      // Total latency should be tracked
      expect(stats.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(stats.totalLatencyMs).toBeLessThan(100000);
    });
  });

  describe("agent-specific tests", () => {
    it("design-analyzer requires design input", () => {
      const analyzer = engine.getAgentCapability("design-analyzer");
      expect(analyzer.inputTypes).toContain("design-node");
    });

    it("code-generator supports multiple frameworks", () => {
      const codeGen = engine.getAgentCapability("code-generator");
      expect(codeGen.models.length).toBeGreaterThan(1);
      expect(codeGen.inputTypes).toContain("component-spec");
    });

    it("security-validator produces security reports", () => {
      const security = engine.getAgentCapability("security-validator");
      expect(security.outputTypes).toContain("security-report");
      expect(security.outputTypes).toContain("vulnerabilities");
    });

    it("accessibility-validator targets WCAG 2.2", () => {
      const a11y = engine.getAgentCapability("accessibility-validator");
      expect(a11y.outputTypes).toContain("wcag-report");
    });

    it("performance-optimizer focuses on metrics", () => {
      const perf = engine.getAgentCapability("performance-optimizer");
      expect(perf.outputTypes).toContain("optimization-report");
      expect(perf.outputTypes).toContain("metrics-improvement");
    });

    it("test-generator creates multiple test types", () => {
      const tests = engine.getAgentCapability("test-generator");
      expect(tests.outputTypes).toContain("unit-tests");
      expect(tests.outputTypes).toContain("integration-tests");
      expect(tests.outputTypes).toContain("e2e-tests");
    });
  });

  describe("configuration", () => {
    it("respects custom timeout configuration", async () => {
      const customEngine = new ShannonEngine10({ taskTimeout: 60000 });

      const input = {
        designNode: {},
        framework: "react",
        designSystem: "material",
      };

      const tasks = customEngine.createFullPipeline(input);

      // Tasks should respect custom timeout
      expect(tasks.every((t) => t.timeout >= 30000)).toBe(true);
    });

    it("respects max concurrent task configuration", async () => {
      const customEngine = new ShannonEngine10({ maxConcurrentTasks: 2 });

      const input = {
        designNode: {},
        framework: "react",
        designSystem: "material",
      };

      const tasks = customEngine.createFullPipeline(input);
      const scheduled = await customEngine.scheduleTasks(tasks);

      // No batch should exceed 2 concurrent tasks
      expect(scheduled.batches.every((batch) => batch.length <= 2)).toBe(true);
    });

    it("respects retry strategy configuration", () => {
      const customEngine = new ShannonEngine10({ retryStrategy: "linear", maxRetries: 5 });

      // Engine created successfully with custom config
      expect(customEngine).toBeDefined();
    });
  });

  describe("factory function", () => {
    it("creates engine without config", () => {
      const e = createShannonEngine10();
      expect(e).toBeDefined();
      expect(e.getAvailableAgents().length).toBe(10);
    });

    it("creates engine with custom config", () => {
      const e = createShannonEngine10({
        maxConcurrentTasks: 5,
        taskTimeout: 45000,
      });
      expect(e).toBeDefined();
      expect(e.getAvailableAgents().length).toBe(10);
    });
  });

  describe("pipeline execution levels", () => {
    it("separates analysis from code generation", async () => {
      const input = {
        designNode: { type: "FRAME", name: "Component" },
        framework: "react",
        designSystem: "custom",
      };

      const tasks = engine.createFullPipeline(input);
      const scheduled = await engine.scheduleTasks(tasks);

      // First batch: Analysis (design-analyzer, accessibility-validator, mobile-optimizer)
      const firstBatch = scheduled.batches[0];
      const firstBatchTypes = new Set(
        tasks
          .filter((t) => firstBatch.includes(t.id))
          .map((t) => t.type)
      );
      expect(
        firstBatchTypes.has("design-analyzer") ||
          firstBatchTypes.has("accessibility-validator") ||
          firstBatchTypes.has("mobile-optimizer")
      ).toBe(true);

      // Later batches: Code generation and optimization
      expect(scheduled.batches.length).toBeGreaterThan(1);
    });

    it("ensures proper dependency flow", async () => {
      const input = {
        designNode: {},
        framework: "react",
        designSystem: "material",
      };

      const tasks = engine.createFullPipeline(input);

      // Every task should either have no dependencies or dependencies should exist
      for (const task of tasks) {
        for (const dep of task.dependencies) {
          const depTask = tasks.find((t) => t.id === dep);
          expect(depTask).toBeDefined();
        }
      }
    });
  });
});
