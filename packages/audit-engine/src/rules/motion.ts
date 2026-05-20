/**
 * motion — WCAG 2.3.3 / 2.2.2 motion and animation rule.
 *
 * Animations must respect prefers-reduced-motion. Flag any node marked
 * with motion that isn't a Component (which can implement the variant).
 */

import type { A11yRule, AuditIssue, AuditInput } from "../types.js";

export const motionRule: A11yRule = {
  id: "motion.reduced-motion",
  wcagCriterion: "2.3.3",
  wcagLevel: "AAA",
  category: "motion",
  description: "Animation/motion must respect prefers-reduced-motion.",
  evaluate(input: AuditInput) {
    const issues: AuditIssue[] = [];

    for (const node of input.nodes) {
      if (!node.hasMotion) continue;

      // If a node animates but isn't a Component, the developer might not implement the reduced-motion variant
      const isComponent = node.type === "COMPONENT" || node.type === "INSTANCE";
      if (!isComponent) {
        issues.push({
          id: `motion-${node.id}`,
          ruleId: "motion.reduced-motion",
          wcagCriterion: "2.3.3",
          category: "motion",
          severity: "moderate",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageName: node.pageName,
          message: "Animated element lacks reduced-motion variant",
          expected: "Provide a no-motion variant for prefers-reduced-motion users",
          observed: "Motion present, no reduced-motion alternative",
          fixSuggestion: {
            summary: "Add a 'motion' boolean variant",
            steps: [
              "Convert to Component Set",
              "Add Variant property 'motion' with values: enabled, reduced",
              "Map to @media (prefers-reduced-motion: reduce) in code",
            ],
            autoFixable: false,
          },
        });
      }
    }

    return { issues };
  },
};
