# @desygn/ui Agent Guide

## Scope
Shared design-system package. This package owns reusable tokens and accessible primitives consumed by product surfaces.

## Rules
- Reuse semantic tokens before introducing new values.
- Public primitives must be exported from `src/primitives/index.ts`.
- Every public primitive must have a Storybook story and deterministic tests for non-trivial behavior.
- Keep keyboard/focus/ARIA/reduced-motion behavior intact.
- Do not add customer-specific branding, private design rules, private screenshots or copied proprietary component APIs.
- Do not hand-edit files in `registry/`; update source/stories and run `npm run registry:generate`.
- A change is incomplete if `npm run registry:check` reports drift.

## Verification
```bash
npm run build --workspace=@desygn/ui
npm run registry:check
npm run build-storybook
npm test
```

## Preferred change order
contract -> tokens/variants -> component -> tests -> story -> registry -> docs -> verification
