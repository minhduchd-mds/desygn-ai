/**
 * Agent Fleet v6 — main barrel
 *
 * @see docs/architecture/AGENT_FLEET_V6.md
 *
 * @example
 * ```ts
 * import {
 *   OrchestratorAgentV6,
 *   WorktreeRunner,
 *   TestRunnerAgent,
 *   LintRunnerAgent,
 *   BuildVerifierAgent,
 *   SelfDiagnosticAgent,
 *   RefactorAgent,
 *   CodeFixAgent,
 *   DiffApplierAgent,
 *   RollbackAgent,
 * } from "@/lib/agents/v6";
 * ```
 */

// Core
export { BaseAgentV6 } from "./BaseAgent";
export type {
  AgentContextV6,
  AgentResultV6,
  AgentLogger,
  FleetName,
} from "./BaseAgent";

export { OrchestratorAgentV6 } from "./OrchestratorAgent";
export type { OrchestrationInput, OrchestrationResult } from "./OrchestratorAgent";

export { WorktreeRunner } from "./WorktreeRunner";
export type { WorktreeHandle, CommandResult, RunOptions } from "./WorktreeRunner";

// Verification fleet
export * from "./verify";

// Self-improvement fleet
export * from "./self-improve";

// Fix application fleet
export * from "./fix";
