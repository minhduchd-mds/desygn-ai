/**
 * providerRouter — Smart AI provider routing engine.
 *
 * Routes tasks to optimal provider based on:
 *   • Task type (chat, code-gen, analysis, validation)
 *   • Complexity level (low → fast model, high → premium model)
 *   • User tier (free → Groq only, pro → Claude/GPT available)
 *   • Token budget & cost constraints
 *   • Latency requirements
 *
 * Provider hierarchy:
 *   Groq 8B-instant  → validation, simple tasks (FREE, 40ms TTFT)
 *   Groq 70B         → generation, chat (FREE, 120ms TTFT)
 *   Claude Sonnet     → premium code-gen ($$, 400ms TTFT)
 *   GPT-4o            → fallback premium ($$$, 500ms TTFT)
 */

// ── Types ────────────────────────────────────────────────────────

export type TaskType = "chat" | "code-gen" | "analysis" | "validation" | "optimization";
export type Complexity = "low" | "medium" | "high";
export type UserTier = "free" | "pro" | "enterprise";
export type ProviderId = "groq" | "anthropic" | "openai" | "local";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  models: ModelOption[];
  baseUrl?: string;
  requiresApiKey: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: ProviderId;
  contextWindow: number;
  costPerInputToken: number;   // USD per 1M tokens
  costPerOutputToken: number;
  avgTTFTMs: number;           // Time to first token
  avgThroughput: number;       // Tokens per second
  capabilities: TaskType[];
  tier: UserTier;              // Minimum tier required
}

export interface RouteDecision {
  model: ModelOption;
  reason: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
  fallback?: ModelOption;
}

export interface RouteRequest {
  task: TaskType;
  complexity: Complexity;
  userTier: UserTier;
  inputTokens: number;
  maxOutputTokens?: number;
  maxLatencyMs?: number;
  maxCostUsd?: number;
  preferredProvider?: ProviderId;
}

export interface RoutingStats {
  totalRequests: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  totalCost: number;
  avgLatencyMs: number;
  failovers: number;
}

// ── Model Registry ───────────────────────────────────────────────

const MODELS: ModelOption[] = [
  // Groq — Free tier
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    provider: "groq",
    contextWindow: 131072,
    costPerInputToken: 0.05,    // $0.05/1M tokens
    costPerOutputToken: 0.08,
    avgTTFTMs: 40,
    avgThroughput: 750,
    capabilities: ["validation", "optimization", "chat"],
    tier: "free",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
    contextWindow: 131072,
    costPerInputToken: 0.59,
    costPerOutputToken: 0.79,
    avgTTFTMs: 120,
    avgThroughput: 275,
    capabilities: ["chat", "code-gen", "analysis", "validation"],
    tier: "free",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    provider: "groq",
    contextWindow: 32768,
    costPerInputToken: 0.24,
    costPerOutputToken: 0.24,
    avgTTFTMs: 60,
    avgThroughput: 500,
    capabilities: ["chat", "validation", "optimization"],
    tier: "free",
  },
  // Anthropic — Pro tier
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200000,
    costPerInputToken: 3.0,
    costPerOutputToken: 15.0,
    avgTTFTMs: 400,
    avgThroughput: 120,
    capabilities: ["chat", "code-gen", "analysis", "validation"],
    tier: "pro",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    costPerInputToken: 0.80,
    costPerOutputToken: 4.0,
    avgTTFTMs: 200,
    avgThroughput: 300,
    capabilities: ["chat", "validation", "analysis", "optimization"],
    tier: "pro",
  },
  // OpenAI — Pro tier
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    costPerInputToken: 2.5,
    costPerOutputToken: 10.0,
    avgTTFTMs: 500,
    avgThroughput: 100,
    capabilities: ["chat", "code-gen", "analysis"],
    tier: "pro",
  },
];

// ── Provider Router ──────────────────────────────────────────────

export class ProviderRouter {
  private stats: RoutingStats = {
    totalRequests: 0,
    byProvider: {},
    byModel: {},
    totalCost: 0,
    avgLatencyMs: 0,
    failovers: 0,
  };

  private customModels: ModelOption[] = [];

  /**
   * Route a task to the optimal model.
   */
  route(request: RouteRequest): RouteDecision {
    const allModels = [...MODELS, ...this.customModels];

    // Filter by user tier (can only use models at or below their tier)
    const tierOrder: UserTier[] = ["free", "pro", "enterprise"];
    const userTierIdx = tierOrder.indexOf(request.userTier);
    const eligible = allModels.filter(m => {
      const modelTierIdx = tierOrder.indexOf(m.tier);
      return modelTierIdx <= userTierIdx;
    });

    // Filter by capability
    const capable = eligible.filter(m => m.capabilities.includes(request.task));

    if (capable.length === 0) {
      // Fallback: return cheapest available model
      const fallback = eligible.sort((a, b) => a.costPerInputToken - b.costPerInputToken)[0];
      if (!fallback) throw new Error("No models available for this tier");
      return {
        model: fallback,
        reason: `No model specifically supports "${request.task}", using cheapest available`,
        estimatedCost: this.estimateCost(fallback, request.inputTokens, request.maxOutputTokens ?? 2000),
        estimatedLatencyMs: fallback.avgTTFTMs,
      };
    }

    // Apply preferred provider filter
    let candidates = capable;
    if (request.preferredProvider) {
      const preferred = capable.filter(m => m.provider === request.preferredProvider);
      if (preferred.length > 0) candidates = preferred;
    }

    // Score candidates
    const scored = candidates.map(model => ({
      model,
      score: this.scoreModel(model, request),
    }));

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0].model;
    const fallback = scored.length > 1 ? scored[1].model : undefined;

    const estCost = this.estimateCost(best, request.inputTokens, request.maxOutputTokens ?? 2000);

    // Record stats
    this.recordRoute(best, estCost);

    return {
      model: best,
      reason: this.explainChoice(best, request),
      estimatedCost: estCost,
      estimatedLatencyMs: best.avgTTFTMs + (request.maxOutputTokens ?? 2000) / best.avgThroughput * 1000,
      fallback,
    };
  }

  /**
   * Get the fast validation model (Groq 8B).
   */
  routeValidation(userTier: UserTier = "free"): RouteDecision {
    return this.route({
      task: "validation",
      complexity: "low",
      userTier,
      inputTokens: 2000,
      maxOutputTokens: 1000,
      maxLatencyMs: 3000,
    });
  }

  /**
   * Get the code generation model (tier-dependent).
   */
  routeCodeGen(userTier: UserTier = "free", complexity: Complexity = "medium"): RouteDecision {
    return this.route({
      task: "code-gen",
      complexity,
      userTier,
      inputTokens: 4000,
      maxOutputTokens: 8000,
    });
  }

  /**
   * Register a custom/local model.
   */
  registerModel(model: ModelOption): void {
    this.customModels.push(model);
  }

  /**
   * Get routing statistics.
   */
  getStats(): RoutingStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      byProvider: {},
      byModel: {},
      totalCost: 0,
      avgLatencyMs: 0,
      failovers: 0,
    };
  }

  /**
   * Get all available models for a tier.
   */
  getAvailableModels(tier: UserTier): ModelOption[] {
    const allModels = [...MODELS, ...this.customModels];
    const tierOrder: UserTier[] = ["free", "pro", "enterprise"];
    const idx = tierOrder.indexOf(tier);
    return allModels.filter(m => tierOrder.indexOf(m.tier) <= idx);
  }

  /**
   * Estimate cost for a request.
   */
  estimateCost(model: ModelOption, inputTokens: number, outputTokens: number): number {
    return (model.costPerInputToken * inputTokens + model.costPerOutputToken * outputTokens) / 1_000_000;
  }

  // ── Internal ─────────────────────────────────────────────────

  private scoreModel(model: ModelOption, request: RouteRequest): number {
    let score = 50; // base

    // Task-model affinity
    const taskAffinity: Record<TaskType, Record<string, number>> = {
      "validation": { "llama-3.1-8b-instant": 100, "claude-haiku-4-5-20251001": 80 },
      "code-gen": { "claude-sonnet-4-20250514": 100, "llama-3.3-70b-versatile": 75, "gpt-4o": 85 },
      "analysis": { "claude-sonnet-4-20250514": 95, "llama-3.3-70b-versatile": 70 },
      "chat": { "llama-3.3-70b-versatile": 90, "llama-3.1-8b-instant": 70 },
      "optimization": { "llama-3.1-8b-instant": 95, "mixtral-8x7b-32768": 80 },
    };

    score += taskAffinity[request.task]?.[model.id] ?? 0;

    // Complexity bonus for larger models
    if (request.complexity === "high") {
      if (model.contextWindow >= 128000) score += 20;
      if (model.avgThroughput < 200) score += 10; // Larger = slower but smarter
    }
    if (request.complexity === "low") {
      score += model.avgTTFTMs < 100 ? 30 : 0; // Fast models win for simple tasks
    }

    // Cost penalty
    const cost = this.estimateCost(model, request.inputTokens, request.maxOutputTokens ?? 2000);
    if (request.maxCostUsd && cost > request.maxCostUsd) score -= 100;
    score -= cost * 1000; // Penalize expensive models

    // Latency penalty
    if (request.maxLatencyMs && model.avgTTFTMs > request.maxLatencyMs) score -= 50;

    return score;
  }

  private explainChoice(model: ModelOption, request: RouteRequest): string {
    if (request.task === "validation" && model.id.includes("8b")) {
      return "Fast 8B model for validation — 3x faster, minimal quality tradeoff";
    }
    if (request.task === "code-gen" && model.provider === "anthropic") {
      return "Claude for premium code generation — best code quality";
    }
    if (request.task === "code-gen" && model.provider === "groq") {
      return "Groq 70B for code generation — free tier, good quality";
    }
    if (model.provider === "groq") {
      return `Groq ${model.name} — fast and cost-effective for ${request.task}`;
    }
    return `${model.name} selected for ${request.task} (${request.complexity} complexity)`;
  }

  private recordRoute(model: ModelOption, cost: number): void {
    this.stats.totalRequests++;
    this.stats.byProvider[model.provider] = (this.stats.byProvider[model.provider] ?? 0) + 1;
    this.stats.byModel[model.id] = (this.stats.byModel[model.id] ?? 0) + 1;
    this.stats.totalCost += cost;
  }
}

// ── Singleton ────────────────────────────────────────────────────

export function createRouter(): ProviderRouter {
  return new ProviderRouter();
}

export function getModelRegistry(): ModelOption[] {
  return [...MODELS];
}
