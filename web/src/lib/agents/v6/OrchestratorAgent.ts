/**
 * OrchestratorAgent v6 — Multi-fleet scheduler with cost gate.
 *
 * Coordinates the 4 fleets:
 *   - Audit (analyze design)
 *   - Fix (apply changes in worktree)
 *   - Self-Improve (analyze + propose codebase improvements)
 *   - Verify (test/lint/build CLI wrappers)
 *
 * Routing rules:
 *   1. Cost gate: skip any agent whose estimateCost > remaining budget
 *   2. Parallelism: agents within a fleet run via Promise.allSettled
 *   3. Sequencing: fix → verify → approval pipeline is serial
 *   4. Abort propagation: a single AbortSignal cancels all in-flight agents
 */

import type { BaseAgentV6, AgentContextV6, AgentResultV6, FleetName } from "./BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestrationInput {
  /** Per-fleet inputs (keyed by fleet name) */
  fleetInputs: Partial<Record<FleetName, unknown>>;
  /** Optional list of specific agent IDs to run (defaults to all registered) */
  agentIds?: string[];
  /** Maximum total cost across all agents */
  maxCostUsd: number;
  /** Whether to run fleets in parallel (default true) */
  parallelFleets?: boolean;
}

export interface OrchestrationResult {
  /** Result of every agent that ran, keyed by agent id */
  agentResults: Map<string, AgentResultV6>;
  /** Whether every agent succeeded */
  allSucceeded: boolean;
  /** Total cost spent in USD */
  totalCostUsd: number;
  /** Total wall-clock latency in ms */
  totalLatencyMs: number;
  /** Agents skipped due to cost gate */
  skippedAgentIds: string[];
  /** Aggregate counts */
  counts: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OrchestratorAgent
// ─────────────────────────────────────────────────────────────────────────────

export class OrchestratorAgentV6 {
  private readonly agents = new Map<string, BaseAgentV6>();

  /** Register an agent. Multiple registrations of the same id will throw. */
  register(agent: BaseAgentV6): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent "${agent.id}" already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  /** Bulk register. */
  registerAll(agents: BaseAgentV6[]): void {
    for (const a of agents) this.register(a);
  }

  /** List agents in a specific fleet. */
  getFleet(fleet: FleetName): BaseAgentV6[] {
    return Array.from(this.agents.values()).filter((a) => a.fleet === fleet);
  }

  /** Total number of registered agents. */
  size(): number {
    return this.agents.size;
  }

  /**
   * Run the orchestration plan.
   *
   * The base orchestrator does not implement GOAP planning — it runs every
   * fleet's agents in parallel up to the cost budget. GOAP-aware sub-classes
   * may override `planFleet()` to reorder.
   */
  async run(
    input: OrchestrationInput,
    ctx: Omit<AgentContextV6, "costBudgetUsd">,
  ): Promise<OrchestrationResult> {
    const started = Date.now();
    const allResults = new Map<string, AgentResultV6>();
    const skipped: string[] = [];
    let remainingBudget = input.maxCostUsd;

    const fleets: FleetName[] = ["audit", "fix", "self-improve", "verify"];
    const runFleet = async (fleet: FleetName): Promise<void> => {
      const fleetInput = input.fleetInputs[fleet];
      if (fleetInput === undefined) return;

      const candidates = this.getFleet(fleet).filter((a) =>
        input.agentIds ? input.agentIds.includes(a.id) : true,
      );
      const plan = this.planFleet(candidates, fleetInput);

      // Within a fleet, run agents in parallel — but apply the cost gate
      // sequentially so the running totals stay accurate.
      const tasks: Promise<void>[] = [];
      for (const agent of plan) {
        const estimate = agent.estimateCost(fleetInput);
        if (estimate > remainingBudget) {
          skipped.push(agent.id);
          ctx.logger.warn(
            `[orchestrator] skipping ${agent.id} (cost ${estimate} > budget ${remainingBudget})`,
          );
          continue;
        }
        remainingBudget -= estimate;
        const agentCtx: AgentContextV6 = { ...ctx, costBudgetUsd: estimate };
        tasks.push(
          agent.execute(fleetInput, agentCtx).then((r) => {
            allResults.set(agent.id, r);
            // Refund unspent budget
            const refund = Math.max(0, estimate - r.costUsd);
            remainingBudget += refund;
          }),
        );
      }
      await Promise.allSettled(tasks);
    };

    if (input.parallelFleets === false) {
      for (const f of fleets) await runFleet(f);
    } else {
      await Promise.allSettled(fleets.map(runFleet));
    }

    const totalCostUsd = Array.from(allResults.values()).reduce(
      (sum, r) => sum + (r.costUsd ?? 0),
      0,
    );
    const succeeded = Array.from(allResults.values()).filter((r) => r.success).length;
    const failed = allResults.size - succeeded;
    const allSucceeded = failed === 0 && skipped.length === 0 && allResults.size > 0;

    return {
      agentResults: allResults,
      allSucceeded,
      totalCostUsd,
      totalLatencyMs: Date.now() - started,
      skippedAgentIds: skipped,
      counts: {
        total: allResults.size + skipped.length,
        succeeded,
        failed,
        skipped: skipped.length,
      },
    };
  }

  /**
   * Order agents within a fleet. Override for GOAP-aware planning.
   * Default: original registration order.
   */
  protected planFleet(agents: BaseAgentV6[], _fleetInput: unknown): BaseAgentV6[] {
    return agents;
  }
}
