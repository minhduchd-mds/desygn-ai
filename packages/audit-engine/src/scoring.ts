/**
 * scoring — Aggregate audit score 0-100 with severity weighting.
 *
 * Pure function. No side effects.
 */

import type { AuditIssue, AuditSummary, RuleCategory } from "./types.js";

const SEVERITY_WEIGHTS = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 0.5,
} as const;

const CATEGORIES: RuleCategory[] = ["contrast", "touch-target", "aria", "keyboard", "heading", "motion", "semantic"];

/** Score 0-100. 100 = perfect. Each issue deducts based on severity. */
export function calculateScore(issues: AuditIssue[]): number {
  const deduction = issues.reduce((sum, i) => sum + SEVERITY_WEIGHTS[i.severity], 0);
  return Math.max(0, Math.min(100, Math.round(100 - deduction)));
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
