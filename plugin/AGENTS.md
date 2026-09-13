# Figma Plugin Agent Guide

## Scope
Figma plugin sandbox code. This layer reads/writes Figma document state and communicates with the plugin UI through typed messages.

## Invariants
- No DOM assumptions in plugin sandbox code.
- Do not expose provider/API secrets or privileged tokens to plugin code.
- Batch Figma API reads; avoid unbounded traversal and per-node network/API patterns.
- Keep serialization explicit and typed; mixed Figma values require safe handling.
- Scoring/audit rules belong in reusable deterministic modules, not plugin handlers.
- Validate messages from the UI before applying document mutations.
- Mutations should be scoped, reversible where practical, and provide useful error results.
- Use neutral synthetic examples only; never embed private client assets, names, screenshots, files or proprietary rules.

## Verification
Run plugin typecheck/build plus tests for changed serializers/handlers and confirm the UI/plugin message contract remains compatible.
