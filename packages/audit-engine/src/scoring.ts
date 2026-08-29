/**
 * scoring — Explainable accessibility risk score.
 *
 * Repository-owned algorithm. It intentionally avoids copying scoring logic
 * from third-party accessibility products. The model combines:
 * - severity risk,
 * - logarithmic repetition saturation,
 * - rule/category breadth,
 * - issue density relative to inspected nodes.
 *
 * The logarithmic saturation prevents one repeated template defect from
 * overwhelming every other signal while still penalising systemic problems.
 */

import type { AuditIssue, AuditSummary, RuleCategory } from "./types.js";

const SEVERITY_WEIGHTS = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 0.5,
} as const;

const CATEGORIES: RuleCategory[] = [
  "contrast",
  "touch-target",
  "aria",
  "keyboard",
  "heading",
  "motion",
  "semantic",
];

export interface ScoreContext {
  /** Total nodes inspected, including nodes without issues. */
  nodeCount?: number;
  /** Number of rules actually evaluated in this run. */
  evaluatedRules?: number;
}

export interface ScoreBreakdown {
  score: number;
  rawRisk: number;
  normalizedRisk: number;
  issueDensity: number;
  ruleBreadth: number;
  categoryBreadth: number;
  criticalCount: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Repeated findings for the same rule have diminishing marginal cost:
 * weightedRisk = severityWeight × (1 + log2(repetitionCount)).
 */
function calculateRawRisk(issues: AuditIssue[]): number {
  const repeatedByRuleAndSeverity = new Map<string, number>();

  for (const issue of issues) {
    const key = `${issue.ruleId}:${issue.severity}`;
    repeatedByRuleAndSeverity.set(key, (repeatedByRuleAndSeverity.get(key) ?? 0) + 1);
  }

  let risk = 0;
  for (const [key, count] of repeatedByRuleAndSeverity) {
    const severity = key.slice(key.lastIndexOf(":") + 1) as AuditIssue["severity"];
    risk += SEVERITY_WEIGHTS[severity] * (1 + Math.log2(Math.max(1, count)));
  }

  return risk;
}

/**
 * Return an explainable 0–100 score where 100 means no detected issues.
 *
 * The denominator scales sub-linearly with document size. Large documents are
 * allowed more findings in absolute terms, but systemic defects still reduce
 * the score through density and breadth multipliers.
 */
export function calculateScoreBreakdown(
  issues: AuditIssue[],
  context: ScoreContext = {},
): ScoreBreakdown {
  if (issues.length === 0) {
    return {
      score: 100,
      rawRisk: 0,
      normalizedRisk: 0,
      issueDensity: 0,
      ruleBreadth: 0,
      categoryBreadth: 0,
      criticalCount: 0,
    };
  }

  const affectedNodes = new Set(issues.map((issue) => issue.nodeId)).size;
  const uniqueRules = new Set(issues.map((issue) => issue.ruleId)).size;
  const uniqueCategories = new Set(issues.map((issue) => issue.category)).size;

  const nodeCount = Math.max(1, context.nodeCount ?? affectedNodes);
  const evaluatedRules = Math.max(1, context.evaluatedRules ?? uniqueRules);

  const rawRisk = calculateRawRisk(issues);
  const exposureCapacity = Math.max(4, Math.sqrt(nodeCount) * Math.sqrt(evaluatedRules));
  const issueDensity = clamp01(affectedNodes / nodeCount);
  const ruleBreadth = clamp01(uniqueRules / evaluatedRules);
  const categoryBreadth = clamp01(uniqueCategories / CATEGORIES.length);

  const breadthMultiplier = 1 + 0.3 * ruleBreadth + 0.2 * categoryBreadth;
  const densityMultiplier = 1 + 0.45 * issueDensity;
  const normalizedRisk = (rawRisk / exposureCapacity) * breadthMultiplier * densityMultiplier;

  // Exponential decay gives a smooth score curve and avoids hard step changes.
  let score = Math.round(100 * Math.exp(-0.28 * normalizedRisk));

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const seriousCount = issues.filter((issue) => issue.severity === "serious").length;

  // Safety ceilings keep severe defects visible even in very large documents.
  if (criticalCount > 0) score = Math.min(score, 79);
  if (criticalCount >= 3) score = Math.min(score, 64);
  if (seriousCount >= 5) score = Math.min(score, 84);

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    rawRisk: Number(rawRisk.toFixed(4)),
    normalizedRisk: Number(normalizedRisk.toFixed(4)),
    issueDensity: Number(issueDensity.toFixed(4)),
    ruleBreadth: Number(ruleBreadth.toFixed(4)),
    categoryBreadth: Number(categoryBreadth.toFixed(4)),
    criticalCount,
  };
}

/** Backward-compatible public score helper. */
export function calculateScore(issues: AuditIssue[], context: ScoreContext = {}): number {
  return calculateScoreBreakdown(issues, context).score;
}

/** Build summary aggregates by severity + category. */
export function summarize(issues: AuditIssue[]): AuditSummary {
  const byCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {} as Record<RuleCategory, number>);

  let critical = 0;
  let serious = 0;
  let moderate = 0;
  let minor = 0;

  for (const issue of issues) {
    if (issue.severity === "critical") critical++;
    else if (issue.severity === "serious") serious++;
    else if (issue.severity === "moderate") moderate++;
    else if (issue.severity === "minor") minor++;

    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1;
  }

  return {
    critical,
    serious,
    moderate,
    minor,
    total: issues.length,
    byCategory,
  };
}
