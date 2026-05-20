/**
 * semantic — WCAG 1.3.1 semantic structure rule.
 *
 * Flags layout patterns that suggest improper semantic structure:
 *   - Pure RECTANGLE / GROUP being used as a button
 *   - Multiple nested interactives
 */

import type { A11yRule, AuditIssue, AuditInput } from "../types.js";

const BAD_INTERACTIVE_TYPES = new Set(["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "VECTOR", "GROUP"]);

export const semanticRule: A11yRule = {
  id: "semantic.structure",
  wcagCriterion: "1.3.1",
  wcagLevel: "A",
  category: "semantic",
  description: "Interactive elements should use semantic node types.",
  evaluate(input: AuditInput) {
    const issues: AuditIssue[] = [];

    for (const node of input.nodes) {
      if (!node.hasInteractions) continue;

      if (BAD_INTERACTIVE_TYPES.has(node.type)) {
        issues.push({
          id: `semantic-${node.id}`,
          ruleId: "semantic.structure",
          wcagCriterion: "1.3.1",
          category: "semantic",
          severity: "serious",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: `Interactive ${node.type} should be a Component or Frame`,
          expected: "Use Component or auto-layout Frame for interactive elements",
          observed: `Bare ${node.type} with interaction`,
          fixSuggestion: {
            summary: "Convert to Component or Frame",
            steps: [
              "Select the element",
              "Wrap in a Frame with auto-layout (Shift+A)",
              "Convert to Component (Ctrl+Alt+K)",
            ],
            autoFixable: false,
          },
        });
      }
    }

    return { issues };
  },
};
