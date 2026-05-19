/**
 * BaseAgent v6 — Unified Agent Interface
 *
 * All agents in Fleet 1-4 implement this contract. Inspired by Orca's
 * CLI-agent agnostic philosophy but typed for in-process execution.
 *
 * Adds to v5 BaseAgent:
 *   - costEstimate() for cost-gate routing
 *   - canRunInWorktree() for fleet isolation
 *   - structured AgentResult with verification metadata
 */

import type { AgentRole } from "../../shannonEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Core types
// ─────────────────────────────────────────────────────────────────────────────

export type FleetName = "audit" | "fix" | "self-improve" | "verify";

export interface AgentContextV6 {
  /** Audit / improvement run ID */
  runId: string;
  /** Project ID */
  projectId: string;
  /** User ID (optional — system runs have no user) */
  userId?: string;
  /** Worktree path if running in isolation, undefined for main */
  worktreePath?: string;
  /** Maximum cost (USD) the agent may consume */
  costBudgetUsd: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Logger */
  logger: AgentLogger;
}

export interface AgentLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface AgentResultV6<TOutput = unknown> {
  /** Whether the agent completed successfully */
  success: boolean;
  /** Structured output (agent-specific) */
  output?: TOutput;
  /** Error message when success=false */
  error?: string;
  /** Actual cost spent in USD */
  costUsd: number;
  /** Wall-clock latency in ms */
  latencyMs: number;
  /** Evidence references for the LearningLoop */
  evidence?: string[];
  /** Files modified (only for generator agents) */
  filesModified?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BaseAgent abstract class
// ─────────────────────────────────────────────────────────────────────────────

export abstract class BaseAgentV6<TInput = unknown, TOutput = unknown> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly fleet: FleetName;
  abstract readonly role: AgentRole;
  abstract readonly description: string;

  /**
   * Estimate cost in USD before execution.
   * Used by OrchestratorAgent for cost-gate routing.
   *
   * Default: 0 (free) — override in agents that call LLMs.
   */
  estimateCost(_input: TInput): number {
    return 0;
  }

  /**
   * Whether this agent requires worktree isolation.
   *
   * - `true` for agents that modify files (Fix Fleet)
   * - `false` for pure analyzers (Audit Fleet, SelfDiagnostic)
   */
  canRunInWorktree(): boolean {
    return false;
  }

  /**
   * Execute the agent. Subclasses implement the agent-specific logic.
   * The base implementation handles timing, error wrapping, and cost tracking.
   */
  async execute(
    input: TInput,
    ctx: AgentContextV6,
  ): Promise<AgentResultV6<TOutput>> {
    const startedAt = Date.now();
    try {
      ctx.logger.info(`[${this.id}] starting`, { fleet: this.fleet, runId: ctx.runId });
      const result = await this.run(input, ctx);
      return {
        success: true,
        output: result.output,
        costUsd: result.costUsd ?? 0,
        latencyMs: Date.now() - startedAt,
        evidence: result.evidence,
        filesModified: result.filesModified,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`[${this.id}] failed: ${message}`);
      return {
        success: false,
        error: message,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  /**
   * Subclass-implemented core logic. Throws on failure.
   * Return value is wrapped in AgentResultV6 by execute().
   */
  protected abstract run(
    input: TInput,
    ctx: AgentContextV6,
  ): Promise<{
    output: TOutput;
    costUsd?: number;
    evidence?: string[];
    filesModified?: string[];
  }>;
}
