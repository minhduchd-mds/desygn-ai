/**
 * audit_figma_for_a11y — unit tests.
 *
 * Covers the pure `formatAuditForLLM` markdown renderer and the zod
 * input schema (defaults + validation). Does NOT hit the Figma network.
 */

import { describe, it, expect } from "vitest";
import type { AuditResult, AuditIssue, Severity, RuleCategory } from "@desygn/audit-engine";
import { formatAuditForLLM, auditFigmaInput } from "../tools/auditFigmaForA11y.js";

// ─── Fixture builders ───────────────────────────────────────────────

function makeIssue(n: number, severity: Severity = "serious"): AuditIssue {
  return {
    id: `issue-${n}`,
    ruleId: `rule-${n}`,
    wcagCriterion: "1.4.3",
    category: "contrast" as RuleCategory,
    severity,
    nodeId: `node-${n}`,
    nodeName: `Node ${n}`,
    nodeType: "TEXT",
    pageName: "Dashboard",
    message: `Issue number ${n} description`,
    expected: "ratio >= 4.5:1",
    observed: "ratio 2.1:1",
  };
}

function makeResult(issueCount: number): AuditResult {
  const issues = Array.from({ length: issueCount }, (_, i) => makeIssue(i + 1));
  return {
    id: "audit-1",
    score: 73,
    issues,
    summary: {
      critical: 2,
      serious: 5,
      moderate: 3,
      minor: 1,
      total: issueCount,
      byCategory: {
        contrast: issueCount,
        "touch-target": 0,
        aria: 0,
        keyboard: 0,
        heading: 0,
        motion: 0,
        semantic: 0,
      },
    },
    durationMs: 12,
    wcagVersion: "2.1",
    wcagLevel: "AA",
    nodeCount: 42,
  };
}

// ─── formatAuditForLLM ──────────────────────────────────────────────

describe("formatAuditForLLM", () => {
  it("includes the score, WCAG version/level, and node count", () => {
    const text = formatAuditForLLM(makeResult(3));
    expect(text).toContain("73/100");
    expect(text).toContain("2.1 level AA");
    expect(text).toContain("42");
  });

  it("includes the severity counts", () => {
    const text = formatAuditForLLM(makeResult(3));
    expect(text).toContain("Critical: 2");
    expect(text).toContain("Serious: 5");
    expect(text).toContain("Moderate: 3");
    expect(text).toContain("Minor: 1");
  });

  it("includes at least one issue's rule, node, and message", () => {
    const text = formatAuditForLLM(makeResult(3));
    expect(text).toContain("rule-1");
    expect(text).toContain("Node 1");
    expect(text).toContain("Issue number 1 description");
    expect(text).toContain("WCAG 1.4.3");
  });

  it("truncates to ~10 issues and notes the remainder", () => {
    const result = makeResult(25);
    const text = formatAuditForLLM(result);
    // 10th issue shown, 11th not.
    expect(text).toContain("Issue number 10 description");
    expect(text).not.toContain("Issue number 11 description");
    expect(text).toContain("Top 10 issue(s)");
    expect(text).toContain("Showing 10 of 25 total issues");
  });

  it("reports a clean result when there are no issues", () => {
    const text = formatAuditForLLM(makeResult(0));
    expect(text).toContain("No accessibility issues found");
    expect(text).toContain("73/100"); // score still rendered
  });
});

// ─── auditFigmaInput (zod) ──────────────────────────────────────────

describe("auditFigmaInput schema", () => {
  it("accepts a valid input and applies defaults (2.2 / AA)", () => {
    const parsed = auditFigmaInput.parse({
      figmaUrl: "https://www.figma.com/design/abc123/My-File?node-id=1%3A2",
      figmaAccessToken: "figd_token",
    });
    expect(parsed.wcagVersion).toBe("2.2");
    expect(parsed.wcagLevel).toBe("AA");
    expect(parsed.figmaUrl).toContain("figma.com");
  });

  it("honors explicit wcagVersion / wcagLevel", () => {
    const parsed = auditFigmaInput.parse({
      figmaUrl: "https://www.figma.com/file/abc123/My-File",
      figmaAccessToken: "figd_token",
      wcagVersion: "2.0",
      wcagLevel: "AAA",
    });
    expect(parsed.wcagVersion).toBe("2.0");
    expect(parsed.wcagLevel).toBe("AAA");
  });

  it("rejects a non-URL figmaUrl", () => {
    const res = auditFigmaInput.safeParse({
      figmaUrl: "not-a-url",
      figmaAccessToken: "figd_token",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a missing token", () => {
    const res = auditFigmaInput.safeParse({
      figmaUrl: "https://www.figma.com/file/abc123/My-File",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an out-of-range wcagVersion", () => {
    const res = auditFigmaInput.safeParse({
      figmaUrl: "https://www.figma.com/file/abc123/My-File",
      figmaAccessToken: "figd_token",
      wcagVersion: "3.0",
    });
    expect(res.success).toBe(false);
  });
});
