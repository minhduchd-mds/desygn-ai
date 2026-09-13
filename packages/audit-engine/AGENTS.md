# @desygn/audit-engine Agent Guide

## Scope
Canonical deterministic audit engine. It owns reusable evidence evaluation, rule execution and scoring.

## Invariants
- No Figma API, DOM, network, provider/model call, persistence or product UI dependency.
- Same normalized input and config must produce the same output.
- Rule ids and output contracts are stable public interfaces.
- A failing rule must not corrupt unrelated rule results.
- Standards/scoring changes require explicit tests and migration notes if results can change materially.
- AI explanations and recommendations belong downstream; prompts must not redefine audit truth.
- Only public standards and independently authored rules are allowed. Do not include private/customer checklists or proprietary evaluation material.

## New rule workflow
1. Define normalized evidence required.
2. Implement a pure rule with stable id and severity.
3. Add boundary, malformed, pass and fail fixtures.
4. Document score impact and remediation metadata.
5. Verify API/MCP/product consume the same result rather than reimplementing it.

## Verification
```bash
npm run build --workspace=@desygn/audit-engine
npm test
npm run test:coverage
```
