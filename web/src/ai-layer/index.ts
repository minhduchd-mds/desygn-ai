/**
 * ai-layer/ — Unified AI Agent orchestration for all experiments.
 *
 * This module is the SINGLE entry point for all AI capabilities.
 * New agents, providers, and experiments are registered here.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                    AI Layer (this)                        │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  AgentRegistry → Provider Router → Execution Pipeline    │
 *   │       ↕               ↕                ↕                 │
 *   │  GOAP Planner    Evidence Memory    PII Scanner          │
 *   │       ↕               ↕                ↕                 │
 *   │  Shannon Engine  Usage Analytics   Collaboration         │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Future experiments:
 *   • Multi-model routing (cheapest model that passes quality gate)
 *   • Agent chaining (output of one → input of next)
 *   • Self-improving prompts (evidence-based prompt tuning)
 *   • A/B testing different agent configurations
 *   • Retrieval-Augmented Generation with design docs
 *   • Tool-use agents (Figma API, GitHub, Vercel)
 */

import { createOrchestrator, type AgentConfig, type AgentRole, type DesignIntelligenceResult, type AgentEvidenceRecord } from "../lib/shannonEngine";
import { GOAPPlanner, createDesignAgentPlanner, type WorldState, type GOAPGoal, type Plan } from "../lib/goapPlanner";
import { PIIScanner, type PIIScanResult } from "../lib/piiDetection";
import { UsageAnalyticsEngine } from "../lib/usageAnalytics";
import { eventBus } from "../lib/eventBus";

// ── Types ──────────────────────────────────────────────────────

export type AgentExperiment = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  /** Rollout percentage (0-100) for gradual rollout */
  rollout: number;
  /** Which user tiers can access this experiment */
  tiers: Array<"free" | "pro" | "team" | "enterprise">;
};

export interface AILayerConfig {
  /** Active experiments */
  experiments: AgentExperiment[];
  /** Global PII protection */
  piiProtection: boolean;
  /** Default provider for chat */
  defaultProvider: "groq" | "anthropic" | "openai" | "local";
  /** Enable GOAP autonomous planning */
  enableGOAP: boolean;
  /** Enable evidence-based learning */
  enableEvidence: boolean;
  /** Max concurrent agent executions */
  maxConcurrency: number;
}

export interface AIExecutionResult {
  success: boolean;
  output: unknown;
  tokensUsed: number;
  latencyMs: number;
  provider: string;
  model: string;
  evidenceId?: string;
  piiClean: boolean;
  experiment?: string;
}

// ── Default Config ─────────────────────────────────────────────

const DEFAULT_AI_CONFIG: AILayerConfig = {
  experiments: [],
  piiProtection: true,
  defaultProvider: "groq",
  enableGOAP: true,
  enableEvidence: true,
  maxConcurrency: 4,
};

// ── Built-in Experiments ───────────────────────────────────────

export const BUILT_IN_EXPERIMENTS: AgentExperiment[] = [
  {
    id: "multi-model-routing",
    name: "Multi-Model Routing",
    description: "Route to cheapest model that passes quality threshold",
    enabled: false,
    config: { qualityThreshold: 0.8, models: ["llama-3.1-8b", "llama-3.3-70b", "claude-sonnet"] },
    rollout: 0,
    tiers: ["pro", "team", "enterprise"],
  },
  {
    id: "agent-chaining",
    name: "Agent Chaining",
    description: "Chain multiple agents: analyze → optimize → generate → validate",
    enabled: true,
    config: { maxChainLength: 5, failFast: true },
    rollout: 100,
    tiers: ["free", "pro", "team", "enterprise"],
  },
  {
    id: "self-improving-prompts",
    name: "Self-Improving Prompts",
    description: "Use evidence scores to auto-tune system prompts over time",
    enabled: false,
    config: { minEvidence: 10, improvementThreshold: 0.05 },
    rollout: 0,
    tiers: ["team", "enterprise"],
  },
  {
    id: "rag-design-docs",
    name: "RAG Design Docs",
    description: "Augment prompts with relevant design documentation chunks",
    enabled: false,
    config: { chunkSize: 512, topK: 5, minSimilarity: 0.7 },
    rollout: 0,
    tiers: ["pro", "team", "enterprise"],
  },
  {
    id: "tool-use-agents",
    name: "Tool-Use Agents",
    description: "Agents that can call Figma API, GitHub, Vercel directly",
    enabled: false,
    config: { allowedTools: ["figma-read", "github-pr", "vercel-deploy"], requireApproval: true },
    rollout: 0,
    tiers: ["enterprise"],
  },
  {
    id: "ab-testing",
    name: "A/B Testing",
    description: "Test different agent configurations with automatic winner selection",
    enabled: false,
    config: { minSamples: 50, confidenceLevel: 0.95 },
    rollout: 0,
    tiers: ["team", "enterprise"],
  },
];

// ── AI Layer Class ─────────────────────────────────────────────

export class AILayer {
  private config: AILayerConfig;
  private orchestrator = createOrchestrator();
  private planner = createDesignAgentPlanner();
  private piiScanner = new PIIScanner();
  private analytics = new UsageAnalyticsEngine();
  private evidenceLog: AgentEvidenceRecord[] = [];
  private executionCount = 0;

  constructor(config?: Partial<AILayerConfig>) {
    this.config = {
      ...DEFAULT_AI_CONFIG,
      experiments: [...BUILT_IN_EXPERIMENTS],
      ...config,
    };
  }

  // ── Core Execution ──────────────────────────────────────────

  /**
   * Execute an AI task through the full pipeline:
   * PII scan → Experiment selection → Provider routing → Execution → Evidence
   */
  async execute(
    input: unknown,
    options: {
      role?: AgentRole;
      complexity?: "low" | "medium" | "high";
      userId?: string;
      tier?: "free" | "pro" | "team" | "enterprise";
    } = {},
  ): Promise<AIExecutionResult> {
    const start = Date.now();
    this.executionCount++;

    // Step 1: PII scan
    let piiClean = true;
    let processedInput = input;
    if (this.config.piiProtection && typeof input === "string") {
      const scan = this.piiScanner.scan(input);
      piiClean = scan.riskLevel === "none";
      if (scan.riskLevel === "high" || scan.riskLevel === "critical") {
        processedInput = this.piiScanner.redact(input);
      }
    }

    // Step 2: Check quotas
    if (options.userId && options.tier) {
      this.analytics.initialize(options.userId, options.tier);
      const canProceed = this.analytics.checkQuota("ai_execution");
      if (!canProceed) {
        return {
          success: false,
          output: { error: "quota_exceeded", message: "Daily generation limit reached" },
          tokensUsed: 0,
          latencyMs: Date.now() - start,
          provider: "none",
          model: "none",
          piiClean,
        };
      }
    }

    // Step 3: Execute via orchestrator
    const result = await this.orchestrator.execute(processedInput, {
      complexity: options.complexity ?? "medium",
      storeEvidence: (record) => { this.evidenceLog.push(record); },
      scanPII: (text) => {
        const scan = this.piiScanner.scan(text);
        return {
          hasPII: scan.riskLevel !== "none",
          redacted: this.piiScanner.redact(text),
        };
      },
    });

    // Step 4: Track usage
    if (options.userId) {
      this.analytics.track("ai_execution", {
        tokens: result.totalTokens,
        latency: result.totalLatencyMs,
        provider: this.config.defaultProvider,
      });
    }

    return {
      success: !result.results.some(r => r.confidence < 0.3),
      output: result.output,
      tokensUsed: result.totalTokens,
      latencyMs: Date.now() - start,
      provider: this.config.defaultProvider,
      model: "multi-agent",
      evidenceId: result.evidenceRecords?.[0]?.agentId,
      piiClean,
    };
  }

  // ── GOAP Planning ──────────────────────────────────────────

  /**
   * Use GOAP to autonomously plan a sequence of actions.
   * Returns the planned steps without executing them.
   */
  plan(goal: GOAPGoal, worldState: WorldState): Plan | null {
    if (!this.config.enableGOAP) return null;
    return this.planner.plan(worldState, goal);
  }

  // ── Experiment Management ──────────────────────────────────

  /** Enable/disable an experiment */
  setExperiment(id: string, enabled: boolean): void {
    this.config.experiments = this.config.experiments.map(exp =>
      exp.id === id ? { ...exp, enabled } : exp,
    );
    eventBus.emit("toast:show", {
      message: `Experiment "${id}" ${enabled ? "enabled" : "disabled"}`,
      type: "info",
    });
  }

  /** Get all experiments with their current state */
  getExperiments(): readonly AgentExperiment[] {
    return this.config.experiments;
  }

  /** Check if an experiment is active for a given user/tier */
  isExperimentActive(id: string, tier: string): boolean {
    const exp = this.config.experiments.find(e => e.id === id);
    if (!exp || !exp.enabled) return false;
    if (!exp.tiers.includes(tier as never)) return false;
    if (exp.rollout < 100) {
      // Deterministic rollout based on experiment id
      const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return (hash % 100) < exp.rollout;
    }
    return true;
  }

  // ── Agent Registration ─────────────────────────────────────

  /** Register a custom agent for experiments */
  registerAgent(config: AgentConfig): void {
    this.orchestrator.registerAgent(config);
  }

  // ── PII Protection ─────────────────────────────────────────

  /** Scan text for PII (exposed for direct use) */
  scanPII(text: string): PIIScanResult {
    return this.piiScanner.scan(text);
  }

  /** Redact PII from text */
  redactPII(text: string): string {
    return this.piiScanner.redact(text);
  }

  // ── Statistics ─────────────────────────────────────────────

  getStats() {
    return {
      totalExecutions: this.executionCount,
      evidenceRecords: this.evidenceLog.length,
      activeExperiments: this.config.experiments.filter(e => e.enabled).length,
      config: { ...this.config, experiments: undefined },
    };
  }

  // ── Configuration ──────────────────────────────────────────

  configure(config: Partial<AILayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<AILayerConfig> {
    return this.config;
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const aiLayer = new AILayer();

// ── Re-exports for convenience ─────────────────────────────────

export type { AgentConfig, AgentRole, DesignIntelligenceResult, AgentEvidenceRecord } from "../lib/shannonEngine";
export type { WorldState, GOAPGoal, Plan } from "../lib/goapPlanner";
export type { PIIScanResult } from "../lib/piiDetection";
