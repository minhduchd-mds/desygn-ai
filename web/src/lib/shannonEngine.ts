/**
 * shannonEngine — Shannon-inspired Multi-Agent Design Intelligence Engine.
 *
 * Borrows from KeygraphHQ/Shannon's architecture:
 *   • Temporal workflow orchestration (5-phase pipeline)
 *   • Specialized agent registry (model/prompt/tools per agent)
 *   • Parallel agent execution for batch operations
 *   • Memory-informed prompts (agentMemory integration)
 *   • "No validation pass, no output" policy
 *
 * Architecture:
 *   ┌──────────────────┐
 *   │  Orchestrator     │ ← routes tasks to specialized agents
 *   └─────┬──────┬──────┘
 *     ┌───▼──┐ ┌─▼────┐ ┌──────────┐ ┌──────────┐
 *     │Analyz│ │GenCod│ │ Validate │ │ Optimize │
 *     │Agent │ │Agent │ │  Agent   │ │  Agent   │
 *     └──────┘ └──────┘ └──────────┘ └──────────┘
 *        ▲                    ▲
 *        └────── AgentMemory ─┘
 */

import type { PipelineContext } from "./aiPipeline";

// ── Types ────────────────────────────────────────────────────────

export type AgentRole = "analyzer" | "generator" | "validator" | "optimizer" | "orchestrator";
export type ModelTier = "fast" | "balanced" | "premium";

export interface AgentConfig {
  id: string;
  role: AgentRole;
  name: string;
  model: ModelConfig;
  systemPrompt: string;
  capabilities: AgentCapability[];
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface ModelConfig {
  tier: ModelTier;
  provider: "groq" | "anthropic" | "openai" | "local";
  modelId: string;
  costPer1kTokens: number;
  avgLatencyMs: number;
}

export type AgentCapability =
  | "design-parsing"
  | "code-generation"
  | "style-extraction"
  | "accessibility-check"
  | "token-optimization"
  | "pattern-detection"
  | "naming-analysis"
  | "component-mapping";

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: "task" | "result" | "error" | "feedback" | "memory-query";
  payload: unknown;
  timestamp: number;
  traceId: string;
  tokenCount?: number;
}

export interface AgentResult {
  agentId: string;
  role: AgentRole;
  output: unknown;
  confidence: number;
  tokensUsed: number;
  latencyMs: number;
  memoryHits: number;
}

export interface OrchestratorPlan {
  id: string;
  phases: PhasePlan[];
  estimatedTokens: number;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
}

export interface PhasePlan {
  phase: number;
  name: string;
  agents: string[];
  parallel: boolean;
  dependsOn?: number;
}

export interface DesignIntelligenceResult {
  plan: OrchestratorPlan;
  results: AgentResult[];
  totalTokens: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  messages: AgentMessage[];
  output: unknown;
}

// ── Agent Registry ───────────────────────────────────────────────

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  "design-analyzer": {
    id: "design-analyzer",
    role: "analyzer",
    name: "Design Analyzer Agent",
    model: {
      tier: "fast",
      provider: "groq",
      modelId: "llama-3.1-8b-instant",
      costPer1kTokens: 0,
      avgLatencyMs: 40,
    },
    systemPrompt: `You are a design system analyzer. Given a serialized Figma node tree, extract:
1. Component hierarchy and atomic design level (atom/molecule/organism)
2. Design patterns (repeated layouts, color clusters, spacing patterns)
3. Naming conventions and inconsistencies
4. Token usage and missing tokens
5. Accessibility concerns (contrast, touch targets, text sizing)
Return structured JSON analysis.`,
    capabilities: ["design-parsing", "pattern-detection", "naming-analysis"],
    maxTokens: 4096,
    temperature: 0.1,
    timeout: 10000,
  },

  "code-generator": {
    id: "code-generator",
    role: "generator",
    name: "Code Generator Agent",
    model: {
      tier: "balanced",
      provider: "groq",
      modelId: "llama-3.3-70b-versatile",
      costPer1kTokens: 0,
      avgLatencyMs: 120,
    },
    systemPrompt: `You are an expert frontend code generator. Given a design analysis:
1. Generate production-ready component code for the target framework
2. Follow framework best practices and conventions
3. Include proper TypeScript types
4. Use design tokens from the project's token system
5. Generate accessible markup (ARIA labels, semantic HTML)
Return complete file contents.`,
    capabilities: ["code-generation", "component-mapping"],
    maxTokens: 8192,
    temperature: 0.2,
    timeout: 30000,
  },

  "quality-validator": {
    id: "quality-validator",
    role: "validator",
    name: "Quality Validator Agent",
    model: {
      tier: "fast",
      provider: "groq",
      modelId: "llama-3.1-8b-instant",
      costPer1kTokens: 0,
      avgLatencyMs: 40,
    },
    systemPrompt: `You are a code quality validator. Given generated component code:
1. Check for syntax errors and TypeScript type issues
2. Verify accessibility (ARIA, semantic elements, contrast)
3. Check that design tokens are used correctly
4. Verify responsive patterns
5. Score the output 0-100
Return validation report with issues and suggestions.`,
    capabilities: ["accessibility-check", "pattern-detection"],
    maxTokens: 2048,
    temperature: 0.0,
    timeout: 10000,
  },

  "token-optimizer": {
    id: "token-optimizer",
    role: "optimizer",
    name: "Token Optimizer Agent",
    model: {
      tier: "fast",
      provider: "groq",
      modelId: "llama-3.1-8b-instant",
      costPer1kTokens: 0,
      avgLatencyMs: 30,
    },
    systemPrompt: `You are a prompt optimizer. Given the full context for a code generation task:
1. Remove redundant information
2. Compress repeated patterns into references
3. Prioritize the most relevant design tokens and patterns
4. Ensure the compressed prompt stays under the token budget
Return the optimized prompt with compression ratio.`,
    capabilities: ["token-optimization", "style-extraction"],
    maxTokens: 2048,
    temperature: 0.0,
    timeout: 5000,
  },
};

// ── Agent Class ──────────────────────────────────────────────────

export class DesignAgent {
  readonly config: AgentConfig;
  private messageLog: AgentMessage[] = [];

  constructor(configOrId: AgentConfig | string) {
    if (typeof configOrId === "string") {
      const found = AGENT_CONFIGS[configOrId];
      if (!found) throw new Error(`Unknown agent: ${configOrId}`);
      this.config = found;
    } else {
      this.config = configOrId;
    }
  }

  async execute(
    input: unknown,
    context: DesignPipelineContext,
  ): Promise<AgentResult> {
    const start = Date.now();
    let memoryHits = 0;

    // Phase 1: Query relevant memories
    const memories = context.queryMemory?.(this.config.role) ?? [];
    memoryHits = memories.length;

    // Phase 2: Build prompt with memory context
    const prompt = this.buildPrompt(input, memories);

    // Phase 3: Execute (simulate or real call)
    const output = context.executeAgent
      ? await context.executeAgent(this.config, prompt)
      : this.simulateExecution(input, prompt);

    const latency = Date.now() - start;
    const tokensUsed = this.estimateTokens(prompt, output);

    // Phase 4: Record result for memory
    const result: AgentResult = {
      agentId: this.config.id,
      role: this.config.role,
      output,
      confidence: this.calculateConfidence(output, memoryHits),
      tokensUsed,
      latencyMs: latency,
      memoryHits,
    };

    // Log message
    this.messageLog.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: this.config.id,
      to: "orchestrator",
      type: "result",
      payload: result,
      timestamp: Date.now(),
      traceId: context.traceId || "default",
      tokenCount: tokensUsed,
    });

    return result;
  }

  getMessages(): AgentMessage[] {
    return [...this.messageLog];
  }

  private buildPrompt(input: unknown, memories: unknown[]): string {
    const parts: string[] = [this.config.systemPrompt];

    if (memories.length > 0) {
      parts.push(`\n--- Relevant memories (${memories.length}) ---`);
      for (const mem of memories.slice(0, 5)) {
        parts.push(JSON.stringify(mem).slice(0, 200));
      }
    }

    parts.push(`\n--- Input ---`);
    parts.push(typeof input === "string" ? input : JSON.stringify(input));

    return parts.join("\n");
  }

  private simulateExecution(input: unknown, _prompt: string): unknown {
    // Deterministic simulation for testing
    switch (this.config.role) {
      case "analyzer":
        return {
          patterns: ["flex-row-gap", "card-shadow", "token-usage"],
          hierarchy: "organism",
          score: 72,
          issues: [],
        };
      case "generator":
        return {
          code: `export function Component() { return <div />; }`,
          framework: "react",
          files: 3,
        };
      case "validator":
        return {
          valid: true,
          score: 88,
          issues: [],
          suggestions: ["Add aria-label to button"],
        };
      case "optimizer":
        return {
          optimizedPrompt: typeof input === "string" ? input.slice(0, 100) : "compressed",
          compressionRatio: 0.65,
          tokensReduced: 450,
        };
      default:
        return { status: "completed" };
    }
  }

  private estimateTokens(prompt: string, output: unknown): number {
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(JSON.stringify(output).length / 4);
    return inputTokens + outputTokens;
  }

  private calculateConfidence(output: unknown, memoryHits: number): number {
    let base = 0.7;
    if (memoryHits > 0) base += Math.min(memoryHits * 0.05, 0.2);
    if (output && typeof output === "object" && "score" in output) {
      base = Math.max(base, (output as { score: number }).score / 100);
    }
    return Math.min(base, 1.0);
  }
}

// ── Extended Pipeline Context ────────────────────────────────────

export interface DesignPipelineContext extends PipelineContext {
  traceId: string;
  tokenBudget: number;
  tokensUsed: number;
  agentResults: Map<string, AgentResult>;
  queryMemory?: (role: AgentRole) => unknown[];
  executeAgent?: (config: AgentConfig, prompt: string) => Promise<unknown>;
}

// ── Orchestrator ─────────────────────────────────────────────────

export class DesignOrchestrator {
  private agents: Map<string, DesignAgent> = new Map();

  constructor() {
    // Register default agents
    for (const [id, config] of Object.entries(AGENT_CONFIGS)) {
      this.agents.set(id, new DesignAgent(config));
    }
  }

  registerAgent(config: AgentConfig): void {
    this.agents.set(config.id, new DesignAgent(config));
  }

  getAgent(id: string): DesignAgent | undefined {
    return this.agents.get(id);
  }

  getAgents(): DesignAgent[] {
    return [...this.agents.values()];
  }

  /**
   * Plan execution strategy based on input complexity.
   */
  plan(input: { components: number; complexity: "low" | "medium" | "high" }): OrchestratorPlan {
    const phases: PhasePlan[] = [];

    // Phase 1: Always analyze first
    phases.push({
      phase: 1,
      name: "Design Analysis",
      agents: ["design-analyzer"],
      parallel: false,
    });

    // Phase 2: Optimize tokens if complex
    if (input.complexity === "high" || input.components > 5) {
      phases.push({
        phase: 2,
        name: "Token Optimization",
        agents: ["token-optimizer"],
        parallel: false,
        dependsOn: 1,
      });
    }

    // Phase 3: Generate code (parallel for multiple components)
    const genAgents = input.components > 1
      ? Array.from({ length: Math.min(input.components, 4) }, () => `code-generator`)
      : ["code-generator"];

    phases.push({
      phase: input.complexity === "high" ? 3 : 2,
      name: "Code Generation",
      agents: genAgents,
      parallel: input.components > 1,
      dependsOn: input.complexity === "high" ? 2 : 1,
    });

    // Phase 4: Always validate
    phases.push({
      phase: phases.length + 1,
      name: "Quality Validation",
      agents: ["quality-validator"],
      parallel: false,
      dependsOn: phases.length,
    });

    // Estimate costs
    const analyzerCfg = AGENT_CONFIGS["design-analyzer"]!;
    const generatorCfg = AGENT_CONFIGS["code-generator"]!;
    const validatorCfg = AGENT_CONFIGS["quality-validator"]!;

    const estTokens =
      analyzerCfg.maxTokens +
      generatorCfg.maxTokens * input.components +
      validatorCfg.maxTokens;

    const estLatency =
      analyzerCfg.model.avgLatencyMs +
      (input.components > 1
        ? generatorCfg.model.avgLatencyMs // parallel = 1x latency
        : generatorCfg.model.avgLatencyMs * input.components) +
      validatorCfg.model.avgLatencyMs;

    return {
      id: `plan-${Date.now()}`,
      phases,
      estimatedTokens: estTokens,
      estimatedCostUsd: estTokens * 0.00001, // ~$0.01/1K tokens average
      estimatedLatencyMs: estLatency,
    };
  }

  /**
   * Execute the full multi-agent pipeline.
   */
  async execute(
    input: unknown,
    options: {
      components?: number;
      complexity?: "low" | "medium" | "high";
      tokenBudget?: number;
      queryMemory?: (role: AgentRole) => unknown[];
      executeAgent?: (config: AgentConfig, prompt: string) => Promise<unknown>;
    } = {},
  ): Promise<DesignIntelligenceResult> {
    const start = Date.now();
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const plan = this.plan({
      components: options.components ?? 1,
      complexity: options.complexity ?? "medium",
    });

    const context: DesignPipelineContext = {
      pipelineId: plan.id,
      variables: new Map(),
      stepResults: new Map(),
      aborted: false,
      traceId,
      tokenBudget: options.tokenBudget ?? 32000,
      tokensUsed: 0,
      agentResults: new Map(),
      queryMemory: options.queryMemory,
      executeAgent: options.executeAgent,
    };

    const allResults: AgentResult[] = [];
    const allMessages: AgentMessage[] = [];
    let lastOutput: unknown = input;

    for (const phase of plan.phases) {
      if (context.aborted) break;

      if (phase.parallel && phase.agents.length > 1) {
        // Parallel execution
        const promises = phase.agents.map(agentId => {
          const agent = this.agents.get(agentId);
          if (!agent) return Promise.resolve(null);
          return agent.execute(lastOutput, context);
        });
        const results = (await Promise.all(promises)).filter(Boolean) as AgentResult[];
        allResults.push(...results);
        for (const r of results) {
          context.agentResults.set(r.agentId, r);
          context.tokensUsed += r.tokensUsed;
          allMessages.push(...(this.agents.get(r.agentId)?.getMessages() ?? []));
        }
        lastOutput = results.map(r => r.output);
      } else {
        // Sequential execution
        for (const agentId of phase.agents) {
          const agent = this.agents.get(agentId);
          if (!agent) continue;

          const result = await agent.execute(lastOutput, context);
          allResults.push(result);
          context.agentResults.set(result.agentId, result);
          context.tokensUsed += result.tokensUsed;
          allMessages.push(...agent.getMessages());

          // Validation gate: "No validation pass, no output"
          if (result.role === "validator") {
            const validation = result.output as { valid: boolean; score: number } | null;
            if (validation && !validation.valid) {
              context.aborted = true;
              break;
            }
          }

          lastOutput = result.output;
        }
      }
    }

    return {
      plan,
      results: allResults,
      totalTokens: context.tokensUsed,
      totalCostUsd: context.tokensUsed * 0.00001,
      totalLatencyMs: Date.now() - start,
      messages: allMessages,
      output: lastOutput,
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────

export function getDefaultAgentConfigs(): Record<string, AgentConfig> {
  return { ...AGENT_CONFIGS };
}

export function createOrchestrator(): DesignOrchestrator {
  return new DesignOrchestrator();
}
