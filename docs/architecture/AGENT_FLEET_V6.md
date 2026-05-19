# ADR-001: Agent Fleet v6 — Autonomous Self-Improving Agent System

**Status:** Proposed
**Date:** 2026-05-19
**Authors:** Desygn AI team
**Influences:** [Stably AI Orca](https://github.com/stablyai/orca), n8n DI patterns, current v5 agentic auditor

---

## Context

Desygn AI v5 ships 8 specialized AI agents for UI/UX audit (`DesignAuditAgent`, `AccessibilityAgent`, `DesignSystemAgent`, `ScoreAgent`, `RecommendAgent`, `FixPlannerAgent`, `IssueWriterAgent`, `MemoryAgent`). They run as a sequential pipeline orchestrated by `shannonEngine.ts` with limited `Promise.all` batching.

**Limitations:**
1. Agents propose fixes (`FixPlannerAgent`) but never apply them — every fix is human-applied.
2. The system audits *designs* but cannot audit its own *codebase*.
3. Failed audits don't trigger learning beyond evidence memory weight adjustments.
4. No isolation between concurrent agent runs — they share process state.
5. Verification (test/lint/build) is external CI, not an integrated agent.

Meanwhile, Stably AI's Orca demonstrates a different architectural axis:
- Git worktree per agent → filesystem isolation
- Visual conductor model → user reviews diffs before merge
- CLI-agent agnostic → wraps any tool as an agent

Orca lacks self-improvement loops but proves the worktree-isolation model works at scale.

## Decision

We will build **Agent Fleet v6** — a four-fleet, 18-agent system that combines:
- Orca's worktree isolation + parallel execution
- Desygn AI's evidence-based learning
- A new self-improvement loop that audits and improves Desygn AI's own codebase

The user remains the **conductor**: every code change requires explicit approval through a diff preview UI.

## Architecture

```
                       ┌──────────────────────────────┐
                       │   USER (Conductor)            │
                       │  • Define goals                │
                       │  • Approve/reject diffs        │
                       │  • Override agent decisions    │
                       └─────────┬────────────────────┘
                                 │
                       ┌─────────▼────────────────────┐
                       │   OrchestratorAgent v6        │
                       │  • GOAP cost-effort planning   │
                       │  • Parallel scheduler          │
                       │  • Cost gate ($MAX_COST_USD)   │
                       └─────────┬────────────────────┘
                                 │ fan-out
        ┌────────────────┬───────┴───────┬────────────────┐
        ▼                ▼               ▼                ▼
   ┌─────────┐    ┌──────────┐   ┌────────────┐  ┌──────────────┐
   │ Audit   │    │  Fix     │   │ SelfImprove│  │  Verify       │
   │ Fleet   │    │  Fleet   │   │  Fleet     │  │  Fleet        │
   │ (8 agt) │    │  (3 agt) │   │  (4 agt)   │  │  (3 agt)      │
   └────┬────┘    └─────┬────┘   └─────┬──────┘  └──────┬───────┘
        │               │              │                │
        └───────────────┴──────────────┴────────────────┘
                                 │
                       ┌─────────▼────────────────────┐
                       │   Shared Infrastructure       │
                       │  • EvidenceMemory (HNSW v3)   │
                       │  • LearningLoop (sigmoid)     │
                       │  • EventBus (60fps stream)    │
                       │  • WorktreeRunner pool        │
                       └──────────────────────────────┘
```

## Fleets

### Fleet 1: Audit (8 agents — existing v5)

No changes. Already proven, 1337 tests passing.

| Agent | Role | Existing module |
|---|---|---|
| `DesignAuditAgent` | analyzer | `web/src/ux-checklist/agents/DesignAuditAgent.ts` |
| `AccessibilityAgent` | analyzer | `web/src/ux-checklist/agents/AccessibilityAgent.ts` |
| `DesignSystemAgent` | analyzer | `web/src/ux-checklist/agents/DesignSystemAgent.ts` |
| `ScoreAgent` | optimizer | `web/src/ux-checklist/index.ts` |
| `RecommendAgent` | generator | `web/src/ux-checklist/index.ts` |
| `FixPlannerAgent` | generator | `web/src/ux-checklist/agents/FixPlannerAgent.ts` |
| `IssueWriterAgent` | generator | `web/src/ux-checklist/agents/IssueWriterAgent.ts` |
| `MemoryAgent` | optimizer | `web/src/lib/evidenceMemory.ts` |

### Fleet 2: Fix Application (3 agents — NEW)

| Agent | Role | Purpose |
|---|---|---|
| `CodeFixAgent` | generator | Generate unified diff from `FixPlan` |
| `DiffApplierAgent` | validator | Apply diff in worktree, surface conflicts |
| `RollbackAgent` | validator | Reset worktree if verification fails |

**Boundary:** This fleet **never** writes to `main` directly. All operations occur inside `.worktrees/{uuid}/`.

### Fleet 3: Self-Improvement (4 agents — NEW)

| Agent | Role | Purpose |
|---|---|---|
| `SelfDiagnosticAgent` | analyzer | Static scan: code smell, dead code, low coverage, TODO/FIXME |
| `TestGenAgent` | generator | LLM-generated tests for uncovered code paths |
| `RefactorAgent` | optimizer | AST-based refactor suggestions (extract method, rename) |
| `DependencyAuditAgent` | analyzer | `npm audit` + Dependabot diff + CVE check |

### Fleet 4: Verification (3 agents — NEW)

CLI tools wrapped as agents implementing `BaseAgent`:

| Agent | Wraps | Role |
|---|---|---|
| `TestRunnerAgent` | `npx vitest run` | validator |
| `LintRunnerAgent` | `npx eslint .` | validator |
| `BuildVerifierAgent` | `npm run typecheck && npm run build` | validator |

## Self-Improvement Loop

```
1. Trigger: scheduled cron OR user-initiated
2. SelfDiagnosticAgent.execute()
   → Returns: ImprovementCandidate[] with cost/impact estimates
3. OrchestratorAgent.plan()
   → GOAP filters by cost gate, returns prioritized queue
4. For each candidate (parallel up to MAX_CONCURRENT):
   4a. WorktreeRunner.create(`improve-{candidate.id}`)
   4b. Spawn relevant generator agent (RefactorAgent, TestGenAgent, etc.)
   4c. CodeFixAgent generates diff
   4d. DiffApplierAgent applies in worktree
   4e. VerifyFleet runs in parallel (test + lint + build)
   4f. If all pass → mark "approval-pending"
       If any fail → RollbackAgent + log evidence
5. UI shows pending approvals to user
6. User clicks Approve → merge worktree to main via PR
   User clicks Reject → log as "negative example" in EvidenceMemory
7. LearningLoop updates pattern weights
```

## Parallel Execution Model

### Level 1 — Inter-fleet
```ts
const [audit, fix, selfImprove, verify] = await Promise.all([
  auditFleet.execute(ctx),
  fixFleet.execute(ctx),
  selfImproveFleet.execute(ctx),
  verifyFleet.execute(ctx),
]);
```

### Level 2 — Intra-fleet
```ts
const auditResults = await Promise.allSettled(
  AUDIT_AGENTS.map(a => a.execute(input, ctx))
);
```

### Level 3 — Worktree-level (Orca pattern)
```ts
await Promise.allSettled(
  candidates.map(c =>
    worktreeRunner.runInIsolation(c, { timeout: 600_000 })
  )
);
```

## Safety Guards

| Guard | Implementation |
|---|---|
| **Cost gate** | `OrchestratorAgent.totalCostUsd` ≤ `MAX_COST_USD` env var |
| **Worktree TTL** | Cleanup any worktree >24h old in `WorktreeRunner.startup()` |
| **Infinite loop** | Self-improve recursion depth ≤ 3 |
| **Branch protection** | `main` is read-only for agents; all writes go through PR |
| **File-level lock** | Map of `filePath → agentId` to prevent concurrent edits |
| **Test failure block** | DiffApplierAgent aborts if `TestRunnerAgent.success = false` |
| **User approval gate** | UI always required for production merge |

## Trade-offs

### Pros
- Self-fix capability differentiates Desygn AI from every other design-audit tool
- Worktree isolation makes parallel agent runs safe
- User-as-conductor preserves trust + accountability
- Builds on existing infrastructure (GOAP, EvidenceMemory, AgentConfig)

### Cons
- ~2-3 weeks engineering effort
- Higher LLM API spend (mitigated by cost gate)
- Worktree operations require Node `child_process` access (not browser-compatible) — server-side only
- Diff-application complexity (conflicts, partial applies)

## Alternatives Considered

### Alt 1: Reuse Orca directly via subprocess
**Rejected.** Orca is an Electron IDE, not a library. Coupling Desygn AI to an IDE conflicts with its web-app + Figma-plugin nature.

### Alt 2: GitHub Copilot Agents
**Rejected.** Closed source, no control over agent customization, vendor lock-in.

### Alt 3: LangGraph orchestration
**Considered.** Powerful but adds heavy dependency. We'd lose the lightweight `BaseAgent` interface that fits the existing codebase. Revisit if multi-step workflows become unmanageable.

### Alt 4: Build small (POC only)
**Considered.** Would only add `SelfDiagnosticAgent` without fix-application. Reduces risk but also reduces the differentiation benefit.

## Compatibility

| Item | Compatibility |
|---|---|
| Existing 8 agents | ✅ Reused as Fleet 1 |
| `shannonEngine.ts` | ⚠️ Refactored into `OrchestratorAgent v6`, kept as deprecated re-export |
| `evidenceMemory.ts` | ✅ Used as-is for all fleets |
| `GOAP planner` | ✅ Extended with cost dimension |
| Server-side execution | ⚠️ New requirement — fix fleet runs Node-only |
| Existing CI workflows | ✅ No changes — new agents augment, don't replace |

## Migration Plan

### Sprint 1 (week 1) — Foundation
1. `WorktreeRunner` class
2. `OrchestratorAgent v6` (replaces shannonEngine internals)
3. `BaseAgent` interface unified across all fleets
4. Verification Fleet (3 CLI-wrapper agents)
5. Tests + docs

### Sprint 2 (week 2) — Self-Improvement Fleet
1. `SelfDiagnosticAgent` (pure static analysis)
2. `TestGenAgent` (LLM + AST)
3. `RefactorAgent` (AST + LLM)
4. `DependencyAuditAgent` (npm + GitHub API)
5. Tests + docs

### Sprint 3 (week 3) — Fix Application + UI
1. `CodeFixAgent` (diff generation)
2. `DiffApplierAgent` (`git apply` wrapper)
3. `RollbackAgent`
4. `FixApprovalUI` component (diff preview + approve/reject)
5. End-to-end self-improvement smoke test
6. Tests + docs

## References

- [Stably AI Orca](https://github.com/stablyai/orca) — worktree-native multi-agent IDE
- [n8n DI Container](https://github.com/n8n-io/n8n) — symbol-token dependency injection
- Desygn AI v5 docs: `docs/DEV_GUIDE.md`, `web/src/ux-checklist/agents/README.md`
- GOAP planner: `web/src/lib/goapPlanner.ts`
- Evidence Memory: `web/src/lib/evidenceMemory.ts`
