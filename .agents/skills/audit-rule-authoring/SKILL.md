---
name: audit-rule-authoring
description: Use when adding or changing accessibility, UI/UX, design-system, code-quality, or visual audit criteria.
---

# Audit Rule Authoring

## Goal
Make audit facts deterministic, explainable, testable and reusable before AI interpretation.

## Procedure
1. Define the public standard or product invariant and cite its source in developer documentation where appropriate.
2. Define normalized evidence fields required by the rule.
3. Put deterministic evaluation/scoring in `packages/audit-engine` or the canonical reusable engine, not in prompts or product UI.
4. Emit stable rule id, severity, evidence, expected/actual values, source location and remediation metadata.
5. Add positive, negative, boundary and malformed-input fixtures.
6. Keep model-assisted explanation/recommendation downstream from the deterministic result.
7. Verify API, MCP and UI consume the same rule output rather than reimplementing it.
8. Run unit, integration and regression tests.

## Reject
- prompt-only rules;
- hidden score changes;
- provider-specific rule models;
- customer/private checklists or copied proprietary criteria;
- a second audit engine for the same domain.

## Output
Rule contract, evidence schema, deterministic implementation, fixtures/tests, scoring impact and downstream compatibility notes.
