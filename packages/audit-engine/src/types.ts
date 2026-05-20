/**
 * audit-engine types — Core types for WCAG audit engine.
 *
 * Mirrors `shared/types.ts` SerializedNode but extracted to keep
 * the engine self-contained (no monorepo workspace dep).
 */

export type WcagVersion = "2.0" | "2.1" | "2.2" | "3.0";
export type WcagLevel = "A" | "AA" | "AAA";
export type Severity = "critical" | "serious" | "moderate" | "minor";
export type RuleCategory = "contrast" | "touch-target" | "aria" | "keyboard" | "heading" | "motion" | "semantic";

/** A node from a Figma file or Design.md tree, simplified for audit input. */
export interface AuditNode {
  id: string;
  name: string;
  type: string;
  pageName?: string;
  /** Computed contrast ratio for text nodes, or undefined. */
  contrastRatio?: number;
  /** Bounding box dimensions in CSS pixels at 1× scale. */
  width?: number;
  height?: number;
  /** True if width × height meet WCAG 2.5.5 / 2.5.8 minimum. */
  touchTargetCompliant?: boolean;
  /** ARIA / semantic role inferred from Figma component / type. */
  inferredRole?: string;
  /** True if node has click, hover, or keyboard interactions. */
  hasInteractions?: boolean;
  /** Heading level 1-6 if this is a heading node. */
  headingLevel?: number;
  /** Text content for screen-reader checks. */
  text?: string;
  /** Whether motion/animation is detected (must respect prefers-reduced-motion). */
  hasMotion?: boolean;
  /** Responsive behavior hints from auto-layout. */
  responsiveBehavior?: "fixed" | "fill" | "hug";
  /** Children for hierarchy checks. */
  children?: AuditNode[];
}

export interface AuditOptions {
  wcagVersion?: WcagVersion;
  wcagLevel?: WcagLevel;
  /** Rule IDs to enable. If omitted, all rules run. */
  rules?: string[];
  /** Include AI-generated fix suggestions (slower, requires LLM). */
  includeAiSuggestions?: boolean;
}

export interface AuditInput {
  nodes: AuditNode[];
  options: AuditOptions;
  /** Optional source metadata (Figma file key, etc). */
  source?: {
    type: "figma" | "design-md" | "uploaded-json";
    fileKey?: string;
    nodeId?: string;
  };
}

export interface AuditIssue {
  id: string;
  ruleId: string;
  wcagCriterion: string;
  category: RuleCategory;
  severity: Severity;
  /** Reference to the offending node. */
  nodeId: string;
  nodeName: string;
  nodeType: string;
  pageName?: string;
  /** Human-readable issue description. */
  message: string;
  /** What the spec expects. */
  expected?: string;
  /** What was observed. */
  observed?: string;
  /** Optional fix suggestion (structured). */
  fixSuggestion?: {
    summary: string;
    steps: string[];
    autoFixable: boolean;
  };
}

export interface AuditSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
  byCategory: Record<RuleCategory, number>;
}

export interface AuditResult {
  id: string;
  score: number;
  issues: AuditIssue[];
  summary: AuditSummary;
  durationMs: number;
  wcagVersion: WcagVersion;
  wcagLevel: WcagLevel;
  /** Reproducibility checksum — same input produces same output. */
  inputChecksum?: string;
  /** Number of nodes evaluated. */
  nodeCount: number;
}

/** Result of evaluating one rule against one input. */
export interface RuleResult {
  issues: AuditIssue[];
}

/** Rule definition — pure function from input to issues. */
export interface A11yRule {
  id: string;
  wcagCriterion: string;
  wcagLevel: WcagLevel;
  category: RuleCategory;
  description: string;
  evaluate(input: AuditInput): Promise<RuleResult> | RuleResult;
}

/** Logger interface (server-side, structured logs). */
export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Engine configuration. */
export interface AuditConfig {
  /** Maximum nodes to audit per request (DoS protection). */
  maxNodes?: number;
  /** Per-rule timeout in milliseconds. */
  ruleTimeoutMs?: number;
}
