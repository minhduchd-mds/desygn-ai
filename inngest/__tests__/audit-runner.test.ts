/**
 * mapIssuesToRows — DB row mapping contract.
 *
 * Only the pure helper is exercised here. The Inngest function itself
 * needs an active runtime + Figma access to test, so it's covered by
 * an integration suite, not by these unit tests.
 */

import { describe, expect, it } from "vitest";
import type { AuditIssue } from "@desygn/audit-engine";
import { mapIssuesToRows } from "../functions/audit-runner.js";

function issue(overrides: Partial<AuditIssue> = {}): AuditIssue {
  return {
    id: "issue-1",
    ruleId: "contrast.text",
    wcagCriterion: "1.4.3",
    category: "contrast",
    severity: "serious",
    nodeId: "1:2",
    nodeName: "Button label",
    nodeType: "TEXT",
    pageName: "Home",
    message: "Text contrast 3.1:1 is below the 4.5:1 minimum.",
    expected: "≥4.5:1",
    observed: "3.1:1",
    fixSuggestion: {
      summary: "Darken the text or lighten the background.",
      steps: ["Pick a darker foreground", "Re-check contrast"],
      autoFixable: false,
    },
    ...overrides,
  };
}

describe("mapIssuesToRows", () => {
  it("returns one row per issue", () => {
    const issues = [issue({ id: "a" }), issue({ id: "b" }), issue({ id: "c" })];
    const rows = mapIssuesToRows("run-xyz", issues);
    expect(rows).toHaveLength(3);
  });

  it("returns an empty array when given no issues", () => {
    expect(mapIssuesToRows("run-xyz", [])).toEqual([]);
  });

  it("stamps every row with the supplied audit_run_id", () => {
    const rows = mapIssuesToRows("run-abc", [issue(), issue()]);
    for (const row of rows) expect(row.audit_run_id).toBe("run-abc");
  });

  it("passes severity, rule_id, and wcag_criterion through verbatim", () => {
    const issues = [
      issue({ severity: "critical", ruleId: "aria.accessible-name", wcagCriterion: "4.1.2" }),
      issue({ severity: "moderate", ruleId: "heading.hierarchy", wcagCriterion: "1.3.1" }),
      issue({ severity: "minor", ruleId: "motion.reduced-motion", wcagCriterion: "2.3.3" }),
    ];
    const rows = mapIssuesToRows("run-1", issues);
    expect(rows.map((r) => r.severity)).toEqual(["critical", "moderate", "minor"]);
    expect(rows.map((r) => r.rule_id)).toEqual([
      "aria.accessible-name",
      "heading.hierarchy",
      "motion.reduced-motion",
    ]);
    expect(rows.map((r) => r.wcag_criterion)).toEqual(["4.1.2", "1.3.1", "2.3.3"]);
  });

  it("preserves node identifiers and labels", () => {
    const [row] = mapIssuesToRows("run-1", [
      issue({ nodeId: "10:99", nodeName: "Submit", nodeType: "INSTANCE", pageName: "Checkout" }),
    ]);
    expect(row.node_id).toBe("10:99");
    expect(row.node_name).toBe("Submit");
    expect(row.node_type).toBe("INSTANCE");
    expect(row.page_name).toBe("Checkout");
  });

  it("converts missing optional strings to null (Supabase-friendly)", () => {
    const [row] = mapIssuesToRows("run-1", [
      issue({ pageName: undefined, expected: undefined, observed: undefined }),
    ]);
    expect(row.page_name).toBeNull();
    expect(row.expected).toBeNull();
    expect(row.observed).toBeNull();
  });

  it("preserves the structured fix_suggestion object verbatim (Supabase jsonb)", () => {
    const fixSuggestion = {
      summary: "Use semantic Button",
      steps: ["Swap FRAME for COMPONENT", "Bind role=button"],
      autoFixable: true,
    } as const;
    const [row] = mapIssuesToRows("run-1", [issue({ fixSuggestion })]);
    expect(row.fix_suggestion).toEqual(fixSuggestion);
  });

  it("normalises missing fix_suggestion to null (so jsonb stores NULL)", () => {
    const [row] = mapIssuesToRows("run-1", [issue({ fixSuggestion: undefined })]);
    expect(row.fix_suggestion).toBeNull();
  });

  it("does not mutate the input issues", () => {
    const issues = [issue()];
    const frozen = Object.freeze({ ...issues[0] });
    issues[0] = frozen;
    expect(() => mapIssuesToRows("run-1", issues)).not.toThrow();
    expect(frozen.id).toBe("issue-1");
  });
});
