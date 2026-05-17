/**
 * Shannon Engine 10-Agent Architecture
 * Extends the 4-agent pipeline to a comprehensive 10-agent system
 * Each agent has specialized responsibility with clear input/output contracts
 */

export type AgentType =
  | "design-analyzer"
  | "accessibility-validator"
  | "mobile-optimizer"
  | "code-generator"
  | "performance-optimizer"
  | "security-validator"
  | "design-system-learner"
  | "documentation-agent"
  | "test-generator"
  | "deployment-orchestrator";

export type AgentModel = "groq-8b" | "groq-70b" | "openai-gpt4" | "claude-3-opus" | "local-llama";

export interface AgentCapability {
  name: string;
  description: string;
  models: AgentModel[];
  inputTypes: string[];
  outputTypes: string[];
  costPerRequest: number;
  latencyMs: number;
  successRate: number;
}

export interface AgentTask {
  id: string;
  type: AgentType;
  input: Record<string, unknown>;
  priority: 0 | 1 | 2; // 0=critical, 1=high, 2=normal
  timeout: number;
  retryCount: number;
  dependencies: string[]; // Task IDs this depends on
}

export interface AgentResult {
  taskId: string;
  agent: AgentType;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  model: AgentModel;
}

export interface AgentOrchestrationConfig {
  maxConcurrentTasks?: number; // default 8
  taskTimeout?: number; // default 30000ms
  enableCircuitBreaker?: boolean; // default true
  retryStrategy?: "exponential" | "linear"; // default exponential
  maxRetries?: number; // default 3
}

/**
 * Agent Capability Registry
 * Defines what each agent can do
 */
const AGENT_CAPABILITIES: Record<AgentType, AgentCapability> = {
  "design-analyzer": {
    name: "Design Analyzer",
    description: "Comprehensive design audit (6 dimensions, WCAG validation, responsive analysis)",
    models: ["groq-8b", "openai-gpt4"],
    inputTypes: ["design-node", "figma-json", "screenshot"],
    outputTypes: ["design-report", "accessibility-issues", "responsive-issues"],
    costPerRequest: 0.05,
    latencyMs: 2000,
    successRate: 0.98,
  },
  "accessibility-validator": {
    name: "Accessibility Validator",
    description: "WCAG 2.2 compliance validation, color contrast, keyboard navigation",
    models: ["groq-8b", "openai-gpt4", "claude-3-opus"],
    inputTypes: ["design-node", "component-code", "screenshot"],
    outputTypes: ["wcag-report", "remediation-steps", "score"],
    costPerRequest: 0.04,
    latencyMs: 1500,
    successRate: 0.99,
  },
  "mobile-optimizer": {
    name: "Mobile Optimizer",
    description: "Responsive design validation, mobile-first optimization, touch targets",
    models: ["groq-8b", "groq-70b"],
    inputTypes: ["design-node", "component-code", "viewport-config"],
    outputTypes: ["mobile-report", "breakpoint-config", "optimization-suggestions"],
    costPerRequest: 0.06,
    latencyMs: 2500,
    successRate: 0.96,
  },
  "code-generator": {
    name: "Code Generator",
    description: "Production code synthesis (React, Vue, Svelte, Flutter, React Native)",
    models: ["groq-70b", "openai-gpt4", "claude-3-opus"],
    inputTypes: ["design-node", "component-spec", "design-system"],
    outputTypes: ["component-code", "styles", "props-interface"],
    costPerRequest: 0.15,
    latencyMs: 5000,
    successRate: 0.92,
  },
  "performance-optimizer": {
    name: "Performance Optimizer",
    description: "Bundle size optimization, load time analysis, rendering performance",
    models: ["groq-8b", "groq-70b"],
    inputTypes: ["component-code", "bundle-analysis", "metrics"],
    outputTypes: ["optimization-report", "code-changes", "metrics-improvement"],
    costPerRequest: 0.08,
    latencyMs: 3000,
    successRate: 0.95,
  },
  "security-validator": {
    name: "Security Validator",
    description: "PII detection, input validation, prompt injection blocking, auth patterns",
    models: ["groq-8b", "openai-gpt4"],
    inputTypes: ["component-code", "design-node", "user-input"],
    outputTypes: ["security-report", "vulnerabilities", "remediation"],
    costPerRequest: 0.07,
    latencyMs: 2000,
    successRate: 0.97,
  },
  "design-system-learner": {
    name: "Design System Learner",
    description: "Pattern recognition, component variation learning, design drift detection",
    models: ["groq-70b", "claude-3-opus"],
    inputTypes: ["design-nodes", "component-library", "usage-history"],
    outputTypes: ["pattern-rules", "drift-detection", "learning-confidence"],
    costPerRequest: 0.12,
    latencyMs: 4000,
    successRate: 0.91,
  },
  "documentation-agent": {
    name: "Documentation Agent",
    description: "API docs, inline comments, prop documentation, usage examples",
    models: ["groq-8b", "groq-70b"],
    inputTypes: ["component-code", "design-node", "props-interface"],
    outputTypes: ["api-docs", "comments", "examples", "readme"],
    costPerRequest: 0.06,
    latencyMs: 2000,
    successRate: 0.94,
  },
  "test-generator": {
    name: "Test Generator",
    description: "Unit tests, integration tests, visual regression tests, E2E scenarios",
    models: ["groq-8b", "groq-70b"],
    inputTypes: ["component-code", "props-interface", "design-spec"],
    outputTypes: ["unit-tests", "integration-tests", "e2e-tests", "test-utils"],
    costPerRequest: 0.10,
    latencyMs: 3500,
    successRate: 0.93,
  },
  "deployment-orchestrator": {
    name: "Deployment Orchestrator",
    description: "CI/CD setup, versioning, release notes, deployment validation",
    models: ["groq-8b", "openai-gpt4"],
    inputTypes: ["component-code", "changelog", "git-context"],
    outputTypes: ["ci-config", "release-notes", "deployment-steps", "version"],
    costPerRequest: 0.08,
    latencyMs: 2500,
    successRate: 0.96,
  },
};

/**
 * Task dependency graph resolver
 * Determines optimal execution order and parallelization
 */
class TaskOrchestrator {
  private tasks: Map<string, AgentTask> = new Map();
  private results: Map<string, AgentResult> = new Map();
  private executionOrder: string[] = [];
  private config: Required<AgentOrchestrationConfig>;

  constructor(config?: AgentOrchestrationConfig) {
    this.config = {
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 8,
      taskTimeout: config?.taskTimeout ?? 30000,
      enableCircuitBreaker: config?.enableCircuitBreaker ?? true,
      retryStrategy: config?.retryStrategy ?? "exponential",
      maxRetries: config?.maxRetries ?? 3,
    };
  }

  /**
   * Add a task to the orchestration queue
   */
  addTask(task: AgentTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task ${task.id} already exists`);
    }
    this.tasks.set(task.id, task);
  }

  /**
   * Resolve task dependencies and determine execution order
   */
  resolveDependencies(): { order: string[]; cycles: string[][] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const order: string[] = [];
    const cycles: string[][] = [];

    const visit = (taskId: string, path: string[]): void => {
      if (visited.has(taskId)) return;

      if (recursionStack.has(taskId)) {
        // Circular dependency detected
        const cycleStart = path.indexOf(taskId);
        cycles.push(path.slice(cycleStart).concat([taskId]));
        return;
      }

      recursionStack.add(taskId);
      const task = this.tasks.get(taskId);

      if (task) {
        for (const dep of task.dependencies) {
          visit(dep, [...path, taskId]);
        }
      }

      recursionStack.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        visit(taskId, []);
      }
    }

    this.executionOrder = order;
    return { order, cycles };
  }

  /**
   * Get optimal execution batches (parallelizable groups)
   */
  getExecutionBatches(): string[][] {
    const { order, cycles } = this.resolveDependencies();

    if (cycles.length > 0) {
      throw new Error(`Circular dependencies detected: ${cycles.map((c) => c.join(" -> ")).join("; ")}`);
    }

    const levels: Map<string, number> = new Map();

    // Assign level to each task based on dependencies
    for (const taskId of order) {
      const task = this.tasks.get(taskId);
      if (!task || task.dependencies.length === 0) {
        levels.set(taskId, 0);
      } else {
        const maxDepLevel = Math.max(...task.dependencies.map((dep) => levels.get(dep) ?? 0));
        levels.set(taskId, maxDepLevel + 1);
      }
    }

    // Group tasks by level
    const batches: string[][] = [];
    const levelMap = new Map<number, string[]>();

    for (const [taskId, level] of levels.entries()) {
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level)!.push(taskId);
    }

    // Create batches respecting max concurrent tasks
    for (let level = 0; level <= Math.max(...Array.from(levels.values())); level++) {
      const levelTasks = levelMap.get(level) || [];
      for (let i = 0; i < levelTasks.length; i += this.config.maxConcurrentTasks) {
        batches.push(levelTasks.slice(i, i + this.config.maxConcurrentTasks));
      }
    }

    return batches;
  }

  /**
   * Store task result
   */
  storeResult(result: AgentResult): void {
    this.results.set(result.taskId, result);
  }

  /**
   * Get results for completed tasks
   */
  getResults(): AgentResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get task statistics
   */
  getStats(): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalCost: number;
    totalLatencyMs: number;
    averageSuccessRate: number;
  } {
    const results = Array.from(this.results.values());
    const completedTasks = results.filter((r) => r.success).length;
    const failedTasks = results.filter((r) => !r.success).length;
    const totalCost = results.reduce((sum, r) => {
      const capability = AGENT_CAPABILITIES[r.agent];
      return sum + (capability?.costPerRequest ?? 0);
    }, 0);
    const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);
    const avgSuccessRate =
      results.length > 0
        ? results.reduce((sum, r) => sum + (r.success ? 1 : 0), 0) / results.length
        : 0;

    return {
      totalTasks: this.tasks.size,
      completedTasks,
      failedTasks,
      totalCost,
      totalLatencyMs,
      averageSuccessRate: avgSuccessRate,
    };
  }
}

/**
 * Multi-Agent Orchestration Engine
 * Manages 10-agent coordination with dependency resolution
 */
export class ShannonEngine10 {
  private orchestrator: TaskOrchestrator;
  private config: AgentOrchestrationConfig;

  constructor(config?: AgentOrchestrationConfig) {
    this.config = config ?? {};
    this.orchestrator = new TaskOrchestrator(config);
  }

  /**
   * Get capability info for an agent
   */
  getAgentCapability(agent: AgentType): AgentCapability {
    return AGENT_CAPABILITIES[agent];
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): AgentType[] {
    return Object.keys(AGENT_CAPABILITIES) as AgentType[];
  }

  /**
   * Create a full design-to-code pipeline with all 10 agents
   */
  createFullPipeline(input: {
    designNode: Record<string, unknown>;
    framework: string;
    designSystem: string;
  }): AgentTask[] {
    const tasks: AgentTask[] = [];

    // Level 0: Analysis phase (can run in parallel)
    const analyzerId = `task_analyzer_${Date.now()}`;
    const a11yId = `task_a11y_${Date.now()}`;
    const mobileId = `task_mobile_${Date.now()}`;

    tasks.push(
      {
        id: analyzerId,
        type: "design-analyzer",
        input: { designNode: input.designNode },
        priority: 0,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [],
      },
      {
        id: a11yId,
        type: "accessibility-validator",
        input: { designNode: input.designNode },
        priority: 0,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [],
      },
      {
        id: mobileId,
        type: "mobile-optimizer",
        input: { designNode: input.designNode },
        priority: 0,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [],
      }
    );

    // Level 1: Code generation (depends on analysis)
    const codeGenId = `task_codegen_${Date.now()}`;
    tasks.push({
      id: codeGenId,
      type: "code-generator",
      input: {
        designNode: input.designNode,
        framework: input.framework,
        designSystem: input.designSystem,
        analysisResults: `[${[analyzerId, a11yId, mobileId].join(",")}]`,
      },
      priority: 0,
      timeout: this.config.taskTimeout ?? 30000,
      retryCount: 0,
      dependencies: [analyzerId, a11yId, mobileId],
    });

    // Level 2: Code validation and optimization
    const securityId = `task_security_${Date.now()}`;
    const perfId = `task_perf_${Date.now()}`;
    const learningId = `task_learning_${Date.now()}`;

    tasks.push(
      {
        id: securityId,
        type: "security-validator",
        input: { componentCode: `[${codeGenId}]` },
        priority: 1,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [codeGenId],
      },
      {
        id: perfId,
        type: "performance-optimizer",
        input: { componentCode: `[${codeGenId}]` },
        priority: 1,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [codeGenId],
      },
      {
        id: learningId,
        type: "design-system-learner",
        input: { designNode: input.designNode, designSystem: input.designSystem },
        priority: 2,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [analyzerId],
      }
    );

    // Level 3: Documentation and testing
    const docsId = `task_docs_${Date.now()}`;
    const testId = `task_tests_${Date.now()}`;

    tasks.push(
      {
        id: docsId,
        type: "documentation-agent",
        input: { componentCode: `[${codeGenId}]` },
        priority: 2,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [codeGenId],
      },
      {
        id: testId,
        type: "test-generator",
        input: { componentCode: `[${codeGenId}]` },
        priority: 1,
        timeout: this.config.taskTimeout ?? 30000,
        retryCount: 0,
        dependencies: [codeGenId],
      }
    );

    // Level 4: Deployment
    const deployId = `task_deploy_${Date.now()}`;
    tasks.push({
      id: deployId,
      type: "deployment-orchestrator",
      input: {
        componentCode: `[${codeGenId}]`,
        tests: `[${testId}]`,
        docs: `[${docsId}]`,
      },
      priority: 1,
      timeout: this.config.taskTimeout ?? 30000,
      retryCount: 0,
      dependencies: [codeGenId, testId, docsId],
    });

    return tasks;
  }

  /**
   * Add and schedule tasks for execution
   */
  async scheduleTasks(tasks: AgentTask[]): Promise<{ batches: string[][]; totalTasks: number }> {
    // Add all tasks to orchestrator
    for (const task of tasks) {
      this.orchestrator.addTask(task);
    }

    // Resolve execution order
    const batches = this.orchestrator.getExecutionBatches();

    return {
      batches,
      totalTasks: tasks.length,
    };
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return this.orchestrator.getStats();
  }
}

/**
 * Factory function for creating 10-agent Shannon engine
 */
export function createShannonEngine10(config?: AgentOrchestrationConfig): ShannonEngine10 {
  return new ShannonEngine10(config);
}
