/**
 * rules/index — Public exports for all WCAG audit rules.
 *
 * Rules are ports of `web/src/ux-checklist/agents/AccessibilityAgent.ts`
 * but as pure functions for server-side execution.
 *
 * Each rule maps to one or more WCAG criteria.
 */

export { contrastRule } from "./contrast.js";
export { touchTargetRule } from "./touch-target.js";
export { ariaRule } from "./aria.js";
export { keyboardRule } from "./keyboard.js";
export { headingRule } from "./heading.js";
export { motionRule } from "./motion.js";
export { semanticRule } from "./semantic.js";

import { contrastRule } from "./contrast.js";
import { touchTargetRule } from "./touch-target.js";
import { ariaRule } from "./aria.js";
import { keyboardRule } from "./keyboard.js";
import { headingRule } from "./heading.js";
import { motionRule } from "./motion.js";
import { semanticRule } from "./semantic.js";
import type { A11yRule } from "../types.js";

/** All 7 default rules. */
export const DEFAULT_RULES: A11yRule[] = [
  contrastRule,
  touchTargetRule,
  ariaRule,
  keyboardRule,
  headingRule,
  motionRule,
  semanticRule,
];
