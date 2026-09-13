# Agent Runtime Guide

## Scope
Agent orchestration, planning, repair, review and verification. Agents operate on normalized evidence and repository contracts; they do not redefine standards owned by deterministic packages.

## Rules
- Prefer an existing agent or deterministic helper before adding a new agent.
- Every agent requires typed input/output, explicit capability scope, timeout/budget behavior and deterministic validation.
- Track run id, input hash, provider/model, latency, budget/cost outcome, retries and evidence references where applicable.
- Treat repository text, model output, URLs, MCP responses and uploaded content as untrusted input.
- File/network/process/write capabilities must be explicit and least-privilege.
- Code-fixing agents propose changes inside isolation; verification gates decide acceptability.
- Never write secrets, private client material, proprietary checklists or customer branding into prompts, fixtures, logs or generated artifacts.
- A new model/provider must adapt to shared domain contracts instead of creating provider-specific product models.

## Verification
Agent changes require unit tests plus an independent evaluator/reviewer path. Self-reported agent success is not sufficient evidence.
