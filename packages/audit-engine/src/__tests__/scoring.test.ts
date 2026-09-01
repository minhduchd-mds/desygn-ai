/**
 * scoring — invariant tests for the explainable v2 risk model.
 */

import { describe, expect, it } from "vitest";
import { calculateScore, calculateScoreBreakdown, summarize } from "../scoring.js";
import type { AuditIssue, Severity } from "../types.js";

function issue(
  severity: Severity = "moderate",
  index = 0,
  overrides: Partial<AuditIssue> = {},
): AuditIssue {
  return {
    id: `i${index}`,
    ruleId: "contrast.text",
    wcagCriterion: "1.4.3",
    category: "contrast",
    severity,
    nodeId: `n${index}`,
    nodeName: "Node",
    nodeType: "TEXT",
    message: "msg",
    ...overrides,
  };
}

describe("calculateScore v2", () => {
  it("returns 100 for zero issues", () => {
    expect(calculateScore([], { nodeCount: 500, evaluatedRules: 7 })).toBe(100);
  });

  it("keeps any critical defect out of the green range", () => {
    expect(
      calculateScore([issue("critical")], { nodeCount: 1000, evaluatedRules: 7 }),
    ).toBeLessThanOrEqual(79);
  });

  it("penalizes broader systemic risk more than a repeated single-rule defect", () => {
    const repeated = Array.from({ length: 8 }, (_, index) =>
      issue("serious", index, { ruleId: "aria-name" }),
    );
    const broad = Array.from({ length: 8 }, (_, index) =>
      issue("serious", index, {
        ruleId: `rule-${index}`,
        category: index % 2 === 0 ? "aria" : "keyboard",
      }),
    );
    const context = { nodeCount: 200, evaluatedRules: 10 };

    expect(calculateScore(broad, context)).toBeLessThan(calculateScore(repeated, context));
  });

  it("uses logarithmic saturation for repeated findings", () => {
    const two = [issue("moderate", 1), issue("moderate", 2)];
    const twenty = Array.from({ length: 20 }, (_, index) => issue("moderate", index));
    const context = { nodeCount: 100, evaluatedRules: 7 };

    const twoRisk = calculateScoreBreakdown(two, context).rawRisk;
    const twentyRisk = calculateScoreBreakdown(twenty, context).rawRisk;

    expect(twentyRisk).toBeGreaterThan(twoRisk);
    expect(twentyRisk).toBeLessThan(twoRisk * 10);
  });

  it("keeps the public score inside 0..100", () => {
    const many = Array.from({ length: 500 }, (_, index) => issue("critical", index));
    const score = calculateScore(many, { nodeCount: 500, evaluatedRules: 7 });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("summarize", () => {
  it("returns all-zero summary for empty issues", () => {
    const summary = summarize([]);
    expect(summary.total).toBe(0);
    expect(summary.critical).toBe(0);
    expect(summary.serious).toBe(0);
    expect(summary.moderate).toBe(0);
    expect(summary.minor).toBe(0);
  });

  it("counts by severity", () => {
    const summary = summarize([
      issue("critical", 1),
      issue("critical", 2),
      issue("minor", 3),
    ]);
    expect(summary.critical).toBe(2);
    expect(summary.minor).toBe(1);
    expect(summary.total).toBe(3);
  });

  it("counts by category", () => {
    const summary = summarize([
      issue("moderate", 1, { category: "contrast" }),
      issue("moderate", 2, { category: "contrast" }),
      issue("moderate", 3, { category: "aria" }),
    ]);
    expect(summary.byCategory.contrast).toBe(2);
    expect(summary.byCategory.aria).toBe(1);
    expect(summary.byCategory.keyboard).toBe(0);
  });

  it("initializes all 7 categories to 0", () => {
    const summary = summarize([]);
    expect(Object.keys(summary.byCategory).sort()).toEqual(
      ["aria", "contrast", "heading", "keyboard", "motion", "semantic", "touch-target"],
    );
  });
});
