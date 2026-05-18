/**
 * @desygn/shared — main barrel
 *
 * Re-exports every public symbol from the shared package so consumers can do:
 *   import { ScoringResult, sanitize, FRAMEWORKS } from "@desygn/shared"
 */

// ── Types (scoring, serialization, plugin messages) ──────────────────────────
export type {
  ScoringDimension,
  ScoringResult,
  ComponentRef,
  PluginProfile,
  SerializedNode,
  SerializedPropertyDef,
  SerializedPaint,
  SerializedEffect,
  SerializedLayoutGrid,
  RenameEntry,
  DesignSystemComponentInfo,
  DesignSystemVariableInfo,
  DesignSystemPageInfo,
  DesignSystemSyncDiagnostics,
  DesignSystemSnapshot,
  FigmaProjectFrameRequest,
  PluginMessage,
  FigmaImportSource,
  ViewportVariant,
  AtomicLevel,
  DependencyNode,
  AtomicInfo,
  ExportPlanItem,
  Severity,
  ColorMapping,
  ScanResult,
  ScanCategory,
  ScanIssue,
  AutoLayoutCandidate,
  AutoLayoutSkipped,
  BatchItemResult,
  BatchScanResult,
  AccessibilityAudit,
  AccessibilityViolation,
} from "./types";
export { SCORE_WEIGHTS } from "./types";
// ViewportType is re-exported by types.ts; expose it here too
export type { ViewportType } from "./viewport";

// ── Constants ─────────────────────────────────────────────────────────────────
export {
  SCORE_UNLOCK_THRESHOLD,
  SCORE_WARN_THRESHOLD,
  MAX_SHORT_NAME_LENGTH,
  MAX_FUZZY_COLOR_DELTA,
  MAX_OPTIMAL_NESTING,
  MAX_DEEP_NESTING,
  SPACING_GRID_MINOR,
  SPACING_GRID_MAJOR,
  MAX_PALETTE_COLORS,
  MAX_FONT_SIZES,
  MIN_TYPE_SCALE,
  MAX_TYPE_SCALE,
  CHARS_PER_TOKEN,
  PROMPT_COMPACT_MAX_DEPTH,
  TOKEN_MAP_DISPLAY_LIMIT,
  RING_COLORS,
  GROQ_MODEL,
  HTML_GEN_MAX_TOKENS,
  SCREEN_GEN_MAX_TOKENS,
  API_SANITIZE_HTML_LIMIT,
  API_SANITIZE_SCREENS_LIMIT,
  SCAN_TIMEOUT_MS,
  DEBOUNCE_MS,
  COPY_FEEDBACK_MS,
} from "./constants";

// ── Frameworks ────────────────────────────────────────────────────────────────
export type {
  FrameworkId,
  StylingApproach,
  StateManagement,
  FrameworkConfig,
  FrameworkFeature,
  GenerationConfig,
  NamingConvention,
  OutputConfig,
  GeneratedFile,
  GenerationResult,
} from "./frameworks";
export {
  FRAMEWORKS,
  getDefaultConfig,
  getFrameworkList,
  supportsStyle,
} from "./frameworks";

// ── Viewport ──────────────────────────────────────────────────────────────────
export { detectViewport } from "./viewport";

// ── Sanitize ──────────────────────────────────────────────────────────────────
export { sanitize } from "./sanitize";

// ── Design Context ────────────────────────────────────────────────────────────
export type {
  TemplateMatch,
  DocSource,
  LayoutPattern,
  ValidationReport,
  Screen,
  DesignContext,
} from "./designContext";
export { createEmptyContext } from "./designContext";

// ── Git Sync ──────────────────────────────────────────────────────────────────
export type {
  GitSyncConfig,
  ProjectConfig,
  ExportConfig,
  OutputMapping,
  TemplateMapping,
  TokenExportConfig,
  SyncConfig,
  CIConfig,
  NotificationConfig,
  NotificationChannel,
  DesignChange,
  DesignChangeType,
  DesignPR,
  PRFile,
} from "./gitSync";
export {
  DEFAULT_GIT_SYNC_CONFIG,
  generateDesignPR,
  generateCommitMessage,
  serializeConfig,
  validateConfig,
} from "./gitSync";

// ── Schemas (Zod) ─────────────────────────────────────────────────────────────
export {
  DesignSourceSchema,
  DesignNodeSchema,
  DesignContextSchema,
  CheckSeveritySchema,
  CheckStatusSchema,
  ChecklistCriterionSchema,
  CheckResultSchema,
  EvidenceArtifactSchema,
  AuditRunSchema,
  GitHubLabelSchema,
  GitHubIssueInputSchema,
  GitHubIssueResponseSchema,
  GitHubPRInputSchema,
} from "./schemas/index";
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
} from "./schemas/index";

// ── Permissions (RBAC) ────────────────────────────────────────────────────────
export type {
  GlobalRole,
  PermissionCheck,
  ProjectRole,
  Role,
  Scope,
  ScopeRecord,
} from "./permissions/index";
export {
  GLOBAL_ROLE_SCOPES,
  PROJECT_ROLE_SCOPES,
  checkPermission,
  combineScopes,
  getResourcePermissions,
  getRoleScopes,
  hasAllScopes,
  hasAnyScope,
  hasScope,
} from "./permissions/index";

// ── Lib (runtime utilities) ───────────────────────────────────────────────────
export { jsonSchemaToZod } from "./lib/index";
export type { JSONSchema } from "./lib/index";
