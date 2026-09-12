---
name: release-readiness
description: Use before merging a platform-level change or preparing any release candidate.
---

# Release Readiness

## Goal
Fail closed on broken contracts, builds, tests, security, accessibility or design-system drift.

## Procedure
1. Confirm the change has one canonical owner and no duplicate implementation.
2. Run lint, typecheck, unit/integration tests and coverage thresholds.
3. Build every affected package/app/plugin; required builds may not use `continue-on-error`.
4. Run registry/design-system drift checks for shared UI changes.
5. Build Storybook and run visual/a11y verification for UI changes.
6. Run relevant Playwright E2E flows.
7. Run security/provenance checks and inspect dependency/workflow changes.
8. Confirm no customer/private/proprietary material is present in the diff.
9. Confirm migration/rollback and observability for stateful or runtime changes.
10. Report every skipped gate with an exact reason; a skipped required gate is not a pass.

## Required evidence
- commands executed and result;
- affected packages/surfaces;
- regression/visual evidence where relevant;
- security/public-repo content scan result;
- remaining known risks.

## Do not
Publish, version or deploy solely because this skill passes. Release actions require explicit owner intent.
