/**
 * touch-target — WCAG 2.5.5 / 2.5.8 touch target size rule.
 *
 * Interactive elements (buttons, links) must be at least 24×24 (2.5.8 AA)
 * or 44×44 (2.5.5 AAA) CSS pixels.
 */

import type { A11yRule, AuditIssue, AuditInput } from "../types.js";

const MIN_SIZE = {
  AA: 24,
  AAA: 44,
} as const;

export const touchTargetRule: A11yRule = {
  id: "touch-target.size",
  wcagCriterion: "2.5.8",
  wcagLevel: "AA",
  category: "touch-target",
  description: "Interactive elements must have sufficient touch target size.",
  evaluate(input: AuditInput) {
    const level = input.options.wcagLevel ?? "AA";
    const required = level === "AAA" ? MIN_SIZE.AAA : MIN_SIZE.AA;
    const issues: AuditIssue[] = [];

    for (const node of input.nodes) {
      if (!node.hasInteractions) continue;
      if (typeof node.width !== "number" || typeof node.height !== "number") continue;

      const minDim = Math.min(node.width, node.height);
      if (minDim < required) {
        issues.push({
          id: `touch-target-${node.id}`,
          ruleId: "touch-target.size",
          wcagCriterion: level === "AAA" ? "2.5.5" : "2.5.8",
          category: "touch-target",
          severity: minDim < required / 2 ? "serious" : "moderate",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: `Touch target ${node.width}×${node.height}px below minimum ${required}×${required}px`,
          expected: `≥ ${required}×${required}px`,
          observed: `${node.width}×${node.height}px`,
          fixSuggestion: {
            summary: "Increase touch target dimensions",
            steps: [
              `Resize to at least ${required}×${required}px`,
              "Or add invisible padding/hit area around the element",
            ],
            autoFixable: false,
          },
        });
      }
    }

    return { issues };
  },
};
