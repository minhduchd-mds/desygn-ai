/**
 * contrast — WCAG 1.4.3 (AA) / 1.4.6 (AAA) text contrast rule.
 *
 * Checks each text node's contrast ratio against background:
 *   - Normal text: 4.5:1 (AA), 7:1 (AAA)
 *   - Large text (≥18pt or ≥14pt bold): 3:1 (AA), 4.5:1 (AAA)
 *
 * Input nodes must have `contrastRatio` populated upstream (Figma plugin
 * computes this; REST adapter must reproduce).
 */

import type { A11yRule, AuditIssue, AuditInput } from "../types.js";

const THRESHOLDS = {
  AA: { normal: 4.5, large: 3.0 },
  AAA: { normal: 7.0, large: 4.5 },
} as const;

export const contrastRule: A11yRule = {
  id: "contrast.text",
  wcagCriterion: "1.4.3",
  wcagLevel: "AA",
  category: "contrast",
  description: "Text must have sufficient contrast against its background.",
  evaluate(input: AuditInput) {
    const level = input.options.wcagLevel ?? "AA";
    const thresholds = level === "AAA" ? THRESHOLDS.AAA : THRESHOLDS.AA;
    const issues: AuditIssue[] = [];

    for (const node of input.nodes) {
      if (typeof node.contrastRatio !== "number") continue;
      if (!node.text || node.text.trim().length === 0) continue;

      // TODO Week 4: detect large text (font size / bold from node attributes)
      const required = thresholds.normal;
      if (node.contrastRatio < required) {
        issues.push({
          id: `contrast-${node.id}`,
          ruleId: "contrast.text",
          wcagCriterion: "1.4.3",
          category: "contrast",
          severity: node.contrastRatio < required - 1 ? "critical" : "serious",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: `Text contrast ${node.contrastRatio.toFixed(2)}:1 fails WCAG ${level} (requires ${required}:1)`,
          expected: `≥ ${required}:1`,
          observed: `${node.contrastRatio.toFixed(2)}:1`,
          fixSuggestion: {
            summary: "Increase color contrast",
            steps: [
              "Darken text or lighten background",
              `Target ratio: ${required}:1 minimum`,
              "Use a contrast checker tool to verify",
            ],
            autoFixable: false,
          },
        });
      }
    }

    return { issues };
  },
};
