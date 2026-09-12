---
name: design-system-governance
description: Use when adding or changing shared UI primitives, tokens, variants, component APIs, Storybook stories, or Figma/code design-system contracts.
---

# Design System Governance

## Goal
Keep shared UI as one machine-readable system across code, docs, Storybook, Figma mappings and agents.

## Procedure
1. Inspect `packages/ui` exports, tokens, tests and stories before editing.
2. Reuse an existing primitive/token whenever semantics match.
3. Define or update the public component contract: props, variants, states, accessibility behavior and deprecations.
4. Implement using semantic tokens. Do not introduce customer/client-specific branding or proprietary design rules.
5. Add/update unit tests and Storybook stories for normal, edge, disabled, loading, error, keyboard/focus and responsive states where relevant.
6. Regenerate/check the component registry.
7. Verify docs and public exports match source.
8. Run lint, typecheck, tests, Storybook build and relevant visual/a11y checks.

## Reject
- duplicate primitives or token systems;
- raw reusable design values when a semantic token exists;
- component API changes without registry/docs/tests;
- copied private design systems, customer names, internal screenshots or proprietary checklists;
- visual changes without verification evidence.

## Output
Contract delta, source changes, registry delta, tests/stories, verification result and any intentional migration/deprecation note.
