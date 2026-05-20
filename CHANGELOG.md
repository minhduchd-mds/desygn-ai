# Nhật ký thay đổi (Changelog)

Tất cả thay đổi quan trọng của Desygn AI được ghi nhận tại đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Phiên bản theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.1.1] — 2026-05-19

Tier 2–3 LLM integration, React wiring layer, security patches, and Chat/Code tab independence.

### Them moi

- **LLMProvider (Tier 2)** — Unified LLM abstraction for Agent Fleet v6:
  - `StubLLMProvider` — Deterministic fallback (0 cost, 0 latency)
  - `GroqLLMProvider` — Llama 3.3 70B via `/api/chat` and `/api/chat-stream`
  - `createLLMProvider()` factory with auto-detection
  - Cost estimation: $0.59/M input, $0.79/M output
- **useAgentRunner (Tier 3)** — React hook bridging UI to Agent Fleet v6:
  - `runAgent()` / `runFleet()` / `listAgents()` / `cancel()` / `reset()`
  - `AgentRunState` with status, runId, results Map, cost, latency tracking
  - AbortController-based cancellation
- **Agent API endpoint** (`api/agents/run.ts`) — Vercel Edge Runtime:
  - 22-agent registry, fleet validation, rate limiting
  - Supports: listAgents, fleet runs, single-agent runs
- **Chat/Code tab independence** — Separate message arrays per workspace tab
- **ChatEngine fix** — Corrected `sendClaudeChat` 4-arg signature with context object
- **20 new tests** — LLMProvider (10), useAgentRunner (5), agents-run API (12), ChatEngine (16)

### Thay doi

- Version bump 5.0.0 → 5.1.1
- Total test count: 1529 → 1577 (106 files)
- `index.ts` barrel: added LLMProvider + useAgentRunner exports

### Bao mat

- `npm audit fix` — 0 vulnerabilities (patched brace-expansion, ws)

## [5.1.0] — 2026-05-19

Agent Fleet v6 — 22-agent autonomous self-improving system with worktree isolation, cost gating, and safety guards.

### Them moi

- **Agent Fleet v6** — 22 agents across 8 fleets:
  - **Command Fleet**: HumanCommandAgent (NL parser, 12 patterns), IssueToTaskAgent (GitHub/Figma/diagnostic issues)
  - **Map Fleet**: RepoMapAgent (repo indexing), ComponentTraceAgent (Figma-to-code mapping), DesignContextAgent (design bridge)
  - **Audit Fleet**: ArchitectureDriftAgent (circular deps via DFS, naming rules, barrel gaps, layer breaches, orphans)
  - **Self-Improve Fleet**: SelfDiagnosticAgent, RefactorAgent (any->unknown, dead disables), TestGenAgent, DependencyAuditAgent, SelfAuditAgent, BenchmarkAgent
  - **Fix Fleet**: CodeFixAgent (unified diffs), DiffApplierAgent (worktree-only), RollbackAgent (git reset+clean), FixApprovalUI (React dark-theme diff viewer)
  - **Safety Fleet**: SafetyGateAgent (7 secret patterns, protected files, max-files policy), RegressionGuardAgent (lint/build/test fail-fast, 120s timeout), ConflictResolverAgent (same-region/adjacent/whole-file detection)
  - **Verify Fleet**: TestRunnerAgent (vitest), LintRunnerAgent (eslint), BuildVerifierAgent (tsc+build)
- **BaseAgentV6** — Abstract base class with FleetName type, cost estimation, worktree support
- **OrchestratorAgentV6** — Multi-fleet scheduler with Promise.allSettled parallelism, cost gate, budget refunds
- **WorktreeRunner** — Git worktree isolation with TTL cleanup, SIGTERM+SIGKILL timeout, AbortSignal support
- **useFixApproval** — Pure reducer hook for proposal approval state (approve/reject/bulk/undo)
- **FixApprovalUI** — Dark-theme diff viewer component with approve/reject/bulk actions
- **Supabase migration 004** — agent_runs table with RLS, agent_health_summary view
- **192 agent-specific tests** across 25 test files — 100% module coverage
- **E2E self-improvement pipeline test** (SelfDiagnostic -> Refactor -> CodeFix -> DiffApply -> Verify)

### Thay doi

- OrchestratorAgent fleet list expanded from 4 to 7 fleets (added command, map, safety)
- Total test count: 1337 -> 1529 (102 files)
- ADR: AGENT_FLEET_V6.md documented with full architecture, implementation status, roadmap

### Bao mat

- SafetyGateAgent blocks `.env*`, `*.pem`, `credentials*`, CI workflows, lock files
- 7 secret detection regex patterns: API keys, AWS AKIA, GitHub PAT ghp_, OpenAI sk-, JWT, private keys
- WorktreeRunner: all agent changes isolated in git worktrees, `main` is read-only
- RegressionGuardAgent: fail-fast lint/build/test gate blocks unsafe patches
- ConflictResolverAgent: detects overlapping patches between parallel agents

## [5.0.1] — 2026-05-19

### Thay doi

- Bump version 1.1.6 -> 5.0.0 (align voi CHANGELOG)
- Them README badges: CI status, npm version, Discussions link
- Cap nhat test count 1192 -> 1313
- Them `.devcontainer` cho GitHub Codespaces
- Hoan thanh Open Source Checklist 33/33

### Tai lieu

- `docs/API.md` — Plugin SDK API reference (8 sections)
- `docs/SELF_HOSTING.md` — Self-hosting guide (Docker, Nginx, Supabase)
- `docs/MAINTAINER_SLA.md` — Maintainer response SLA
- `CLA.md` — Contributor License Agreement
- `TRADEMARK.md` — Brand & trademark guidelines

## [5.0.0] — 2026-05-18

Kiến trúc v5: Agentic UI/UX Auditor — hệ thống đa agent tự học với 8 agent chuyên biệt, tích hợp GitHub/CI, và streaming real-time.

### Thêm mới
- **Agentic UI/UX Auditor** — 8 agent chuyên biệt hoạt động theo pipeline:
  - `DesignAuditAgent` — Phân tích thiết kế 6 chiều (Naming, Structure, Tokens, Meta, Completeness, Variants)
  - `AccessibilityAgent` — Kiểm tra WCAG 2.2, touch targets, ARIA, contrast ratio
  - `DesignSystemAgent` — Đánh giá tuân thủ design system (Material3, Ant Design, VTS)
  - `ScoreAgent` — Hiệu chỉnh điểm với Bayesian + Evidence Memory
  - `RecommendAgent` — Gợi ý cải thiện theo mức ưu tiên
  - `FixPlannerAgent` — Tạo kế hoạch sửa lỗi chi tiết (effort, impact, dependencies)
  - `IssueWriterAgent` — Tự động tạo GitHub Issues từ kết quả audit
  - `MemoryAgent` — Học tập liên dự án với HNSW vector search
- **CriteriaRegistry** — 19 tiêu chí tích hợp sẵn, hỗ trợ thêm/xóa tiêu chí động
- **Self-Learning Loop** — Sigmoid decay, user feedback, weight adjustment tự động
- **Real-time Streaming** (`stream.ts`) — AuditStream events, StreamBuffer 60fps, React hook `useAuditStream`
- **GitHub Bridge** (`github.ts`) — Tạo Issues, batch issues, PR description, label suggestions
- **CI Gate** (`ci.ts`) — Score threshold blocking, SARIF v2.1.0, GitHub Actions workflow generation
- **Deploy Gate** — Vercel/Netlify blocking + Slack webhook notifications
- **Cross-Project Learning** (`memory.ts`) — Weight aggregation, pattern detection, GDPR forget
- **PR Automation** — Branch names, commit messages, merge checklists tự động

### Thêm mới (Kiến trúc)
- **Modular Architecture v5** — Tách `main.tsx` (4200+ dòng) thành 6 module:
  - `app-shell/` — Toast, theme, global config
  - `workspace-store/` — Reactive state (useSyncExternalStore)
  - `chat-engine/` — AI chat với provider abstraction
  - `design-engine/` — Design.md generation + validation
  - `auth/` — Session controller + TTL watchdog
  - `ai-layer/` — AI experiment orchestration (multi-model, A/B testing)
- **SplitView upgrade** — Mobile panel switch, summary bar, word count, screen completion stats
- **splitViewHelpers.ts** — Pure functions (slugify, combineScreens, extractHeadings, countWords)
- 1192 tests trên 69 files (tăng từ 1047)

### Thay đổi
- Pipeline agent: Figma Plugin → DesignAudit → Score → Recommend → FixPlanner → IssueWriter → Memory → CIGate
- Evidence Memory snapshot v1 → v2 (tương thích ngược)
- Cấu trúc thư mục: `.claude/` configs chuyển ra `.vscode/` và `docs/`

## [2.0.0] — 2026-05-17

Nâng cấp kiến trúc v3: Self-Learning Agent, GOAP Planning, PII Protection, và accessibility intelligence.

### Thêm mới
- **Self-Learning Agent v3** (`evidenceMemory.ts`) — HNSW vector search, sigmoid decay, StatsCache O(1), garbage collection
- **GOAP Planner** (`goapPlanner.ts`) — A* search over action space, plan caching với LRU, dynamic cost functions
- **GOAP ↔ Shannon Bridge** (`goapShannonBridge.ts`) — Kết nối 13 GOAP actions với 10 Shannon agents, replanning
- **PII Detection Engine** (`piiDetection.ts`) — Luhn credit card, SSN, Vietnamese CCCD/CMND/phone, smart redaction
- **Usage Analytics** (`usageAnalytics.ts`) — 4 SaaS tiers, feature flags với rollout %, quota enforcement
- **Shannon Engine v3** — 2 agent mới (a11y-auditor, evidence-curator), PII scanning, evidence storage
- **Collaboration Engine v3** — PII protection trên CRDT ops (block/redact/warn), evidence tracking
- **Design Analyzer v3** — WCAG 2.2 touch targets, ARIA validation, contrast ratios, PII exposure
- **Figma Serializer v3** — `inferredRole`, `touchTargetCompliant`, `contrastRatio`, `hasInteractions`, `responsiveBehavior`
- **E2E Pipeline Tests** — 13 integration tests + 22 GOAP bridge tests
- 890 tests mới (tổng: 1047 trên 61 files)

### Thay đổi
- Evidence Memory snapshot version v1 → v2 (tương thích ngược)
- Touch target threshold 44×44 → 24×24 (WCAG 2.5.8)
- Shannon Engine agents 4 → 6

### Bảo mật
- Cập nhật `dompurify` 3.4.3 → 3.4.4 (XSS patch)
- Xóa deprecated `@types/dompurify`
- Cập nhật `vite` 8.0.5 → 8.0.13, `vitest` 4.1.1 → 4.1.6
- Tất cả dependencies ở phiên bản mới nhất (0 npm audit vulnerabilities)

## [1.1.5] — 2026-04-28

Sửa lỗi Auto Layout Fix: chỉ frame ngoài cùng giữ FIXED sizing, tất cả bên trong phải là FILL hoặc HUG.

### Sửa lỗi
- Children của converted frames không còn bị set FIXED pixel sizes
- Frame self-sizing phân biệt outermost vs nested
- Counter-axis alignment phát hiện chính xác
- Pattern "value-pinned-right" được skip thay vì convert destructively

### Thêm mới
- 30 unit tests cho `canHugContent`, `decideChildSizing`, `detectPrimaryAlignment`, `detectCounterAlignment`, `gapVariance`

## [1.1.4] — 2026-04-28

Sửa 2 lỗi từ Figma Community re-review (request #1873667).

### Sửa lỗi
- Rescan button giờ re-fetch live selection thay vì dùng cached data
- "Delete N empty layers" không còn đếm instance children (read-only trong Figma)

## [1.1.3] — 2026-04-28

Khôi phục manifest fields cần thiết cho Figma Community publish.

### Sửa lỗi
- `manifest.json` khôi phục `id` và `networkAccess` cho Community listing

## [1.1.2] — 2026-04-28

Sửa tương thích với dynamic-page documentAccess mode.

### Sửa lỗi
- 4 call sites migrate từ `figma.getNodeById()` → `figma.getNodeByIdAsync()`

### Thay đổi
- `manifest.json` khai báo `"documentAccess": "dynamic-page"`

## [1.1.1] — 2026-04-22

Hoàn thiện viewport gap fix cho v1.1.0.

### Sửa lỗi
- Viewport gap fix hoàn chỉnh — scoring-meta module import `detectViewport` từ `shared/viewport.ts`
- README responsive-detection list thêm `-phone` và `-laptop` suffixes

## [1.1.0] — 2026-04-22

Bảo trì và nâng chất lượng dựa trên audit README-vs-code.

### Thêm mới
- Responsive-suffix detection nhận diện Tailwind breakpoints (`xs`, `2xl`, `3xl`) + `phone`, `laptop`
- Tests cho `extractBaseName` và `detectViewport`

### Sửa lỗi
- Skill-sync block bị duplicate N+1 lần trong batch prompts
- Viewport detection gap cho frames 1025–1199px

### Thay đổi
- Viewport classification gom vào `shared/viewport.ts` — single source of truth

## [1.0.0] — 2026-03-26

Phiên bản công khai đầu tiên.

- 6-Dimension Scoring (Naming, Structure, Tokens, Meta, Completeness, Variants)
- Compact prompt generation với self-check và state hints
- Skill Sync block cho Claude-side design system maintenance
- Design System Profiles với import từ Figma Variables, Paint Styles, local components
- Batch Mode với atomic build order (atoms → molecules → organisms)
- Auto Layout Fix với confidence-based analysis
- Quick Fixes (rename generic layers, convert dividers, delete hidden/empty nodes)
- Atomic Detection (atom/molecule/organism classification)
- Responsive viewport detection từ sibling frames
- Prompt injection protection qua sanitisation

[Unreleased]: https://github.com/minhduchd-mds/desygn-ai/compare/v5.1.0...HEAD
[5.1.0]: https://github.com/minhduchd-mds/desygn-ai/compare/v5.0.1...v5.1.0
[5.0.1]: https://github.com/minhduchd-mds/desygn-ai/compare/v5.0.0...v5.0.1
[5.0.0]: https://github.com/minhduchd-mds/desygn-ai/compare/v2.0.0...v5.0.0
[2.0.0]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.1.5...v2.0.0
[1.1.5]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/minhduchd-mds/desygn-ai/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/minhduchd-mds/desygn-ai/releases/tag/v1.0.0
