---
name: visual-verification
description: Use for any UI change that can alter layout, styling, tokens, responsive behavior, component states, screenshots, or rendered output.
---

# Visual Verification

## Goal
Treat visual correctness as test evidence, not a subjective final glance.

## Procedure
1. Identify affected routes/stories/components and target viewports.
2. Build the relevant app or Storybook from the exact commit being verified.
3. Capture deterministic screenshots for desktop, tablet and mobile where the surface supports them.
4. Compare against the approved baseline or previous production artifact.
5. Classify differences: intentional design change, rendering noise, content instability, responsive regression, token drift, overflow/clipping, focus-state regression or accessibility regression.
6. For intentional changes, update baseline only with explicit evidence in the change/PR.
7. Run keyboard/focus and reduced-motion checks for interactive components.
8. Persist screenshot/diff artifacts in CI when available.

## Fail conditions
- unexpected geometry or token drift;
- clipping/overflow at supported breakpoints;
- missing focus indication or broken keyboard flow;
- screenshot generation failure for a required surface;
- baseline update with no source change explaining the visual delta.

## Output
Affected surfaces, viewport matrix, screenshot/diff evidence, classification of each delta and pass/fail result.
