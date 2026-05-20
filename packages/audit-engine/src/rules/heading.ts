/**
 * heading — WCAG 1.3.1 heading hierarchy rule.
 *
 * Headings within a page should not skip levels (h1 → h3 without h2).
 * At least one h1 must exist per logical page.
 */

import type { A11yRule, AuditIssue, AuditInput, AuditNode } from "../types.js";

export const headingRule: A11yRule = {
  id: "heading.hierarchy",
  wcagCriterion: "1.3.1",
  wcagLevel: "A",
  category: "heading",
  description: "Heading levels must form a logical hierarchy without skipping.",
  evaluate(input: AuditInput) {
    const issues: AuditIssue[] = [];

    // Group nodes by page
    const byPage = new Map<string, AuditNode[]>();
    for (const node of input.nodes) {
      if (typeof node.headingLevel !== "number") continue;
      const page = node.pageName ?? "(no-page)";
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page)!.push(node);
    }

    for (const [page, headings] of byPage) {
      if (headings.length === 0) continue;

      const levels = headings.map((h) => h.headingLevel!).sort((a, b) => a - b);
      const hasH1 = levels.includes(1);

      if (!hasH1) {
        const firstHeading = headings.sort(
          (a, b) => (a.headingLevel ?? 99) - (b.headingLevel ?? 99),
        )[0];
        issues.push({
          id: `heading-no-h1-${page}`,
          ruleId: "heading.hierarchy",
          wcagCriterion: "1.3.1",
          category: "heading",
          severity: "moderate",
          nodeId: firstHeading.id,
          nodeName: firstHeading.name,
          nodeType: firstHeading.type,
          pageName: page,
          message: `Page "${page}" has no H1 heading`,
          expected: "Each page should start with exactly one H1",
          observed: `First heading is H${firstHeading.headingLevel}`,
        });
      }

      // Check for skipped levels
      for (let i = 1; i < levels.length; i++) {
        const skip = levels[i] - levels[i - 1];
        if (skip > 1) {
          const offending = headings.find((h) => h.headingLevel === levels[i])!;
          issues.push({
            id: `heading-skip-${offending.id}`,
            ruleId: "heading.hierarchy",
            wcagCriterion: "1.3.1",
            category: "heading",
            severity: "moderate",
            nodeId: offending.id,
            nodeName: offending.name,
            nodeType: offending.type,
            pageName: offending.pageName,
            message: `Heading skips from H${levels[i - 1]} to H${levels[i]}`,
            expected: `Use H${levels[i - 1] + 1} between H${levels[i - 1]} and H${levels[i]}`,
            observed: `Jump of ${skip} levels`,
          });
        }
      }
    }

    return { issues };
  },
};
