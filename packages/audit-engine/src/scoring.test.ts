import { describe, expect, it } from "vitest";

import { calculateScore, calculateScoreBreakdown } from "./scoring.js";
import type { AuditIssue, Severity } from "./types.js";

function issue(
  severity: Severity,
  index: number,
  overrides: Partial<AuditIssue> = {},
): AuditIssue {
  return {
    id: `issue-${index}`,
    ruleId: overrides.ruleId ?? "contrast-minimum",
    wcagCriterion: "1.4.3",
    category: overrides.category ?? "contrast",
    severity,
    nodeId: overrides.nodeId ?? `node-${index}`,
    nodeName: `Node ${index}`,
    nodeType: "TEXT",
    message: "fixture",
    ...overrides,
  };
}

describe("density-aware scoring", () => {
  it("returns 100 when no issue is detected", () => {
    expect(calculateScore([], { nodeCount: 500, evaluatedRules: 7 })).toBe(100);
  });

  it("never lets a critical issue produce a green score", () => {
    const score = calculateScore([issue("critical", 1)], {
      nodeCount: 1000,
      evaluatedRules: 7,
    });

    expect(score).toBeLessThanOrEqual(79);
  });

  it("penalises broader systemic risk more than one repeated defect", () => {
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

    const twoRisk = calculateScoreBreakdown(two, {
      nodeCount: 100,
      evaluatedRules: 7,
    }).rawRisk;
    const twentyRisk = calculateScoreBreakdown(twenty, {
      nodeCount: 100,
      evaluatedRules: 7,
    }).rawRisk;

    // 10× findings should increase risk, but by substantially less than 10×.
    expect(twentyRisk).toBeGreaterThan(twoRisk);
    expect(twentyRisk).toBeLessThan(twoRisk * 10);
  });

  it("keeps the score inside the public 0-100 contract", () => {
    const manyCritical = Array.from({ length: 500 }, (_, index) => issue("critical", index));
    const score = calculateScore(manyCritical, {
      nodeCount: 500,
      evaluatedRules: 7,
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
