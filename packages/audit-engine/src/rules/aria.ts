/**
 * aria — WCAG 1.3.1 / 4.1.2 ARIA role and accessible name rule.
 *
 * Interactive elements must have an inferable role + accessible name.
 */

import type { A11yRule, AuditIssue, AuditInput } from "../types.js";

export const ariaRule: A11yRule = {
  id: "aria.accessible-name",
  wcagCriterion: "4.1.2",
  wcagLevel: "A",
  category: "aria",
  description: "Interactive elements must expose name, role, and value to assistive tech.",
  evaluate(input: AuditInput) {
    const issues: AuditIssue[] = [];

    for (const node of input.nodes) {
      if (!node.hasInteractions) continue;

      const hasRole = !!(node.inferredRole && node.inferredRole !== "unknown");
      const hasName = !!(node.name && node.name.trim().length > 0) || !!node.text;

      if (!hasRole) {
        issues.push({
          id: `aria-role-${node.id}`,
          ruleId: "aria.accessible-name",
          wcagCriterion: "1.3.1",
          category: "aria",
          severity: "serious",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: "Interactive element has no inferable ARIA role",
          expected: "Element should map to a known role (button, link, etc.)",
          observed: "No role detected",
          fixSuggestion: {
            summary: "Add explicit role or use semantic component",
            steps: [
              "Use a Component instance with a clear role (Button, Link, Input)",
              "Or add component description with role hint",
            ],
            autoFixable: false,
          },
        });
      }

      if (!hasName) {
        issues.push({
          id: `aria-name-${node.id}`,
          ruleId: "aria.accessible-name",
          wcagCriterion: "4.1.2",
          category: "aria",
          severity: "critical",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: "Interactive element lacks accessible name",
          expected: "Visible text label or aria-label equivalent",
          observed: "No text content or descriptive name",
          fixSuggestion: {
            summary: "Add visible label or icon description",
            steps: [
              "Add text label to button/link",
              "For icon-only: rename layer to descriptive name (e.g. 'icon/close')",
            ],
            autoFixable: false,
          },
        });
      }
    }

    return { issues };
  },
};
