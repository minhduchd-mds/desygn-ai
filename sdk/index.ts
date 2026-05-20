/**
 * @desygn/sdk — Public SDK for Desygn AI
 *
 * Stable public API surface for building plugins, integrations, and
 * automation on top of the Desygn AI platform.
 *
 * @example
 * ```ts
 * import { defineAgent, defineCriterion, ChecklistCriterionSchema } from "@desygn/sdk";
 *
 * // Define a custom audit criterion
 * const myCriterion = defineCriterion({
 *   id: "my-org.brand-spacing",
 *   name: "Brand spacing scale",
 *   category: "tokens",
 *   severity: "medium",
 *   description: "Spacing must follow the brand 4/8/16 scale",
 * });
 *
 * // Define a custom agent
 * const myAgent = defineAgent({
 *   id: "my-org.brand-checker",
 *   name: "Brand Checker",
 *   role: "audit",
 *   execute: async (input, ctx) => {
 *     return { success: true, output: { score: 0.9 } };
 *   },
 * });
 * ```
 *
 * @see {@link https://github.com/minhduchd-mds/desygn-ai/blob/main/docs/API.md|API Reference}
 * @see {@link https://github.com/minhduchd-mds/desygn-ai/blob/main/sdk/examples|Examples}
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Schemas (re-exported from @desygn/shared for convenience)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Design context
  DesignSourceSchema,
  DesignNodeSchema,
  DesignContextSchema,
  // Checklist
  CheckSeveritySchema,
  CheckStatusSchema,
  ChecklistCriterionSchema,
  CheckResultSchema,
  EvidenceArtifactSchema,
  AuditRunSchema,
  // GitHub
  GitHubLabelSchema,
  GitHubIssueInputSchema,
  GitHubIssueResponseSchema,
  GitHubPRInputSchema,
} from "../shared/schemas/index";

export type {
  DesignSource,
  DesignNode,
  CheckSeverity,
  CheckStatus,
  ChecklistCriterion,
  CheckResult,
  EvidenceArtifact,
  AuditRun,
  GitHubLabel,
  GitHubIssueInput,
  GitHubIssueResponse,
  GitHubPRInput,
} from "../shared/schemas/index";

// ═══════════════════════════════════════════════════════════════════════════════
// Permissions / RBAC
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  GlobalRole,
  ProjectRole,
  Role,
  Scope,
  ScopeRecord,
  PermissionCheck,
} from "../shared/permissions/index";

export {
  GLOBAL_ROLE_SCOPES,
  PROJECT_ROLE_SCOPES,
  checkPermission,
  hasScope,
  hasAllScopes,
  hasAnyScope,
  combineScopes,
  getResourcePermissions,
  getRoleScopes,
} from "../shared/permissions/index";

// ═══════════════════════════════════════════════════════════════════════════════
// SDK Helpers — define* functions for plugin authors
// ═══════════════════════════════════════════════════════════════════════════════

export {
  defineAgent,
  defineCriterion,
  defineCheck,
  definePlugin,
} from "./helpers";

export type {
  PluginManifest,
  PluginContext,
  CustomAgent,
  CustomCriterion,
  CustomCheck,
  CheckFunction,
  AgentInput,
  AgentOutput,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// Sanitization
// ═══════════════════════════════════════════════════════════════════════════════

export { sanitize } from "../shared/sanitize";

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

export { jsonSchemaToZod } from "../shared/lib/index";
export type { JSONSchema } from "../shared/lib/index";

// ═══════════════════════════════════════════════════════════════════════════════
// Version
// ═══════════════════════════════════════════════════════════════════════════════

export const SDK_VERSION = "0.1.0";
