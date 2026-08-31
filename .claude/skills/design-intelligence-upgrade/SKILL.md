---
name: Design Intelligence Upgrade
version: 0.1.0
description: Use when Desygn AI gains a new design source, audit capability, design-system intelligence feature, recommendation workflow, agent action, or implementation/verification loop that spans product, API, package, data, or deployment boundaries.
---

# Design Intelligence Upgrade

## Goal
Keep new capabilities inside the product loop:

`source -> normalized representation -> analysis/evidence -> recommendation -> optional action -> independent verification`

## Procedure
1. Define user/job and success metric.
2. Map the source data and normalize contracts before prompts/UI.
3. Decide deterministic vs model-assisted responsibilities. Standards, scoring, policy, identifiers, permissions, and persisted contracts stay deterministic.
4. Define evidence/provenance emitted with model-assisted conclusions.
5. Define API/runtime constraints, including Edge vs Node transitive dependency compatibility and deployment topology.
6. Build a dependency-aware task graph with package build order.
7. Define UX for partial evidence, provider failure, retry, unsupported source, and ambiguous recommendation.
8. Require independent reviewer/evaluator after implementation.

## Reject
- model prompts becoming the only definition of a product rule;
- a new provider-specific domain model;
- hidden scoring changes without explainability/tests;
- feature work that belongs in the reusable tool/runtime/knowledge layer;
- a deployment design that assumes paid platform limits without documenting them.

## Output
Product spec delta, contracts, task DAG, eval oracle, rollout/rollback, and provenance notes.
