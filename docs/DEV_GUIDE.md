# Desygn AI — Developer Guide

## Quick Start
```bash
npm run dev       # Watch mode (UI + plugin)
npm run build     # Production → dist/
npm test          # Vitest (1187 tests)
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

## Agent System

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

## Repositories
- **Origin:** github.com/minhduchd-mds/Design-md-ai
- **Official:** github.com/designready-ai/designready-ai
- **Dev:** github.com/Lapse18/designready-ai-plugin

## IDE Configuration
See `.vscode/launch.json` for development server configuration.
