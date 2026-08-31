---
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*)
argument-hint: <product goal or technical upgrade>
description: Convert a Desygn AI goal into a repository-grounded product, architecture, UX, and implementation plan.
---

Plan without editing files: $ARGUMENTS

Return:
- user/product outcome and success metric;
- current-state repo evidence;
- ownership decision: product vs reusable runtime/tool/knowledge layer;
- architecture and rejected alternatives;
- dependency-aware task graph;
- affected package/API/data/runtime surfaces;
- UX states and evidence requirements;
- test/eval oracle, migration, rollback, observability;
- deployment and licensing/provenance risks.

Finish with implementation order and merge gates.
