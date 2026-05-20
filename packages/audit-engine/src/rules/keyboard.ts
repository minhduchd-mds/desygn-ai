/**
 * keyboard — WCAG 2.1.1 / 2.4.7 keyboard access + focus indicator.
 *
 * Design-time check: every interactive element should have a defined
 * focus style. Since static designs can't fully verify this, we flag
 * interactive elements that don't appear to be standard Figma Components
 * (which typically have focus variants).
 */

import type { A11yRule, AuditIssue, AuditInput } from "../types.js";

export const keyboardRule: A11yRule = {
  id: "keyboard.focus-indicator",
  wcagCriterion: "2.4.7",
  wcagLevel: "AA",
  category: "keyboard",
  description: "Interactive elements must have visible focus indicators.",
  evaluate(input: AuditInput) {
    const issues: AuditIssue[] = [];

    for (const node of input.nodes) {
      if (!node.hasInteractions) continue;

      // Heuristic: non-COMPONENT/INSTANCE interactive nodes often lack focus styles
      const isComponent = node.type === "COMPONENT" || node.type === "INSTANCE";
      if (!isComponent) {
        issues.push({
          id: `keyboard-focus-${node.id}`,
          ruleId: "keyboard.focus-indicator",
          wcagCriterion: "2.4.7",
          category: "keyboard",
          severity: "moderate",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: "Interactive element is not a Component — focus state may be missing",
          expected: "Convert to Component with a Focused variant",
          observed: `Standalone ${node.type} with interaction`,
          fixSuggestion: {
            summary: "Convert to a Component Set with focus variant",
            steps: [
              "Select the interactive element",
              "Create Component (Ctrl+Alt+K)",
              "Add Variant property 'state' with values: default, hover, focused, disabled",
            ],
            autoFixable: false,
          },
        });
      }
    }

    return { issues };
  },
};
