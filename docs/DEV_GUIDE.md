# Desygn AI — Developer Guide

## Quick Start
```bash
npm run dev       # Watch mode (UI + plugin)
npm run build     # Production → dist/
npm test          # Vitest (1577 tests)
npm run lint      # ESLint 9
```

## Architecture Overview

### Module Structure (v5)
```
web/src/
├── ai-layer/           # AI experiment orchestration (multi-model, A/B testing)
├── app-shell/          # Toast, theme, global config
├── auth/               # Session controller + TTL watchdog
├── chat-engine/        # AI chat with provider abstraction
├── design-engine/      # Design.md generation + validation
├── workspace-store/    # Reactive state (useSyncExternalStore)
├── ux-checklist/       # Agentic UI/UX Auditor v5
│   ├── index.ts        #   Orchestrator + CriteriaRegistry + LearningLoop
│   ├── agents.ts       #   5 specialized agents (Audit, A11y, DesignSystem, FixPlanner, IssueWriter)
│   ├── github.ts       #   GitHub Issue/PR bridge
│   ├── stream.ts       #   Real-time audit streaming + React hook
│   ├── memory.ts       #   Cross-project learning + persistence
│   └── ci.ts           #   CI gate + SARIF + Deploy gate
├── lib/
│   ├── shannonEngine.ts    # Multi-agent orchestrator
│   ├── evidenceMemory.ts   # HNSW vector search + sigmoid decay
│   ├── goapPlanner.ts      # Goal-Oriented Action Planning (A*)
│   ├── designAnalyzer.ts   # WCAG scoring + design debt
│   ├── piiDetection.ts     # PII scanner + redaction
│   ├── usageAnalytics.ts   # Usage tracking + quotas
│   └── eventBus.ts         # Global event system
├── design/                 # Layout validator
└── workspace/              # Checklist data + chat handlers

plugin/     → Figma sandbox (no DOM, no fetch). Only Figma API.
ui/         → React iframe (no figma.*). Only parent.postMessage.
shared/
├── types.ts     → All message types + SerializedNode
└── viewport.ts  → Pure utilities usable from both sandboxes
```

### Communication
- Plugin ↔ UI: typed `PluginMessage` via `postMessage` only
- AI Layer: Shannon Engine → GOAP Planner → Evidence Memory pipeline
- State: `useSyncExternalStore`-based stores (workspace, project, UI)

## Hard Rules
- **Never** call Figma API in loops — batch everything
- **Never** use `findAll()` — use `findAllWithCriteria()` on `currentPage` only
- Serializer: `isMixed()` check before reading mixed properties. Max depth 15
- Async calls (`getMainComponentAsync`) must be wrapped in try/catch
- Scoring modules: pure functions, no side effects, no Figma API
- Prompt text: always sanitize via `sanitize.ts` (injection risk)
- CSS Modules per component. Dark theme only. Gap-based layout
- New serializer field: types.ts → serializer.ts → prompt-compact.ts

## Agent System (v5)

### Pipeline
```
Figma Plugin ──scan──▶ DesignAuditAgent ──▶ ScoreAgent ──▶ RecommendAgent
                            │                    │               │
                            ▼                    ▼               ▼
                     AccessibilityAgent   DesignSystemAgent  FixPlannerAgent
                            │                    │               │
                            ▼                    ▼               ▼
                     IssueWriterAgent     MemoryAgent        CIGate
                     (GitHub Issues)    (Learn+Persist)    (Block deploy)
```

### Self-Learning Loop
1. Agent evaluates criterion → produces `AuditResult`
2. `ScoreAgent` calibrates with Bayesian historical evidence
3. `LearningLoop` stores result in Evidence Memory (HNSW)
4. User feedback (agree/disagree/irrelevant) adjusts criterion weights
5. Sigmoid decay on unvalidated evidence (knowledge half-life)
6. Next audit uses calibrated weights → better scores over time

## Agent Fleet v6

> Full ADR: [`docs/architecture/AGENT_FLEET_V6.md`](architecture/AGENT_FLEET_V6.md)

### Architecture

22 agents across 8 fleets, coordinated by `OrchestratorAgentV6`:

```
web/src/lib/agents/v6/
├── BaseAgent.ts              # Abstract base, FleetName, AgentContextV6
├── OrchestratorAgent.ts      # Multi-fleet scheduler + cost gate
├── WorktreeRunner.ts         # Git worktree isolation
├── command/                  # HumanCommandAgent, IssueToTaskAgent
├── map/                      # RepoMapAgent, ComponentTraceAgent, DesignContextAgent
├── audit/                    # ArchitectureDriftAgent
├── self-improve/             # SelfDiagnostic, Refactor, TestGen, DepAudit, SelfAudit, Benchmark
├── fix/                      # CodeFix, DiffApplier, Rollback, useFixApproval
├── safety/                   # SafetyGate, RegressionGuard, ConflictResolver
├── verify/                   # TestRunner, LintRunner, BuildVerifier
└── __tests__/                # 25 test files, 192 tests
```

### Adding a New Agent

1. Create `web/src/lib/agents/v6/<fleet>/MyAgent.ts`
2. Extend `BaseAgentV6<Input, Output>` — implement `run()` and `estimateCost()`
3. Set `id`, `name`, `fleet`, `role`, `description`
4. Export from `<fleet>/index.ts` and `v6/index.ts`
5. Create test file in `__tests__/MyAgent.test.ts`
6. Register in `OrchestratorAgentV6` when wiring layer is built (E-series roadmap)

### BaseAgentV6 Contract

```typescript
abstract class BaseAgentV6<TInput = unknown, TOutput = unknown> {
  abstract readonly id: string;         // "fleet.agent-name"
  abstract readonly name: string;
  abstract readonly fleet: FleetName;   // "audit" | "command" | "fix" | "map" | "safety" | "self-improve" | "verify"
  abstract readonly role: "analyzer" | "generator" | "validator" | "optimizer" | "orchestrator";

  abstract estimateCost(input: TInput): number;
  protected abstract run(input: TInput, ctx: AgentContextV6): Promise<{ output: TOutput; costUsd?: number; evidence?: string[] }>;

  // execute() wraps run() with timing, error handling, cost tracking
  async execute(input: TInput, ctx: AgentContextV6): Promise<AgentResultV6<TOutput>>;
  canRunInWorktree(): boolean;          // Override to allow worktree execution
}
```

### WorktreeRunner Mock Pattern

All agents using WorktreeRunner follow this test pattern:

```typescript
vi.mock("../WorktreeRunner", () => {
  const mockRun = vi.fn();
  return {
    WorktreeRunner: class MockRunner { run = mockRun; },
    __mockRun: mockRun,
  };
});
const { __mockRun: mockRun } = await import("../WorktreeRunner") as unknown as { __mockRun: ReturnType<typeof vi.fn> };
```

### Safety Rules

- **Never** commit to `main` from agents — all changes go through worktrees
- `SafetyGateAgent` blocks: `.env*`, `*.pem`, `credentials*`, CI workflows, lock files
- 7 secret detection regex patterns scan all diffs before applying
- `RegressionGuardAgent` runs lint → build → test with 120s timeout per step
- User must approve every patch via `FixApprovalUI` before merge

## Repository
- **Origin:** github.com/minhduchd-mds/desygn-ai

## IDE Configuration
See `.vscode/launch.json` for development server configuration.
