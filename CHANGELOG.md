# Nhật ký thay đổi (Changelog)

Tất cả thay đổi quan trọng của Desygn AI được ghi nhận tại đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Phiên bản theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.1.0](https://github.com/minhduchd-mds/desygn-ai/compare/v5.0.0...v5.1.0) (2026-09-01)


### Features

* add Google Gemini as parallel AI provider alongside Groq ([62a0675](https://github.com/minhduchd-mds/desygn-ai/commit/62a0675e7393dde53706fa2d0f65248a755f9b1c))
* Agent Fleet v6 — autonomous self-improving agent system ([1d1d0c8](https://github.com/minhduchd-mds/desygn-ai/commit/1d1d0c88385fad54193a73401f663b20413e85f4))
* **api:** Week 1 — auth (JWT + API key) + tier quota foundation ([7340db4](https://github.com/minhduchd-mds/desygn-ai/commit/7340db49f2d270af937c74f22e42aa3bd103f738))
* **audit-engine:** real WCAG color math + correct contrast thresholds ([ef8280a](https://github.com/minhduchd-mds/desygn-ai/commit/ef8280ade58f18f3f4a13ca5825ea101cb4a897e))
* **chat:** add image/video/file attachment support in messages ([6bd3b07](https://github.com/minhduchd-mds/desygn-ai/commit/6bd3b07f2b4dac4b29158c6606cf1bdd5d3c8bc5))
* **chat:** enable image rendering in AI responses ([aaa3abe](https://github.com/minhduchd-mds/desygn-ai/commit/aaa3abe6fef59098ca8b21a67b620b38509679aa))
* chạy song song — api/a11y endpoints + dashboard shell + marketing site ([7ae809e](https://github.com/minhduchd-mds/desygn-ai/commit/7ae809eb9c6454e5c7664df4001f3b1e8d36bc3b))
* chạy song song — audit UI + MCP a11y tool + PDF reports ([6ffa26b](https://github.com/minhduchd-mds/desygn-ai/commit/6ffa26b556aa8dfd2b42df92eabfef61e9a9c8b7))
* chạy song song — verify page + audit-list/status + Inngest runner ([7ce7bd0](https://github.com/minhduchd-mds/desygn-ai/commit/7ce7bd0a4c4e3616170cba3e6deb8ba32c785e5e))
* **dashboard:** i18n (Tiếng Việt mặc định) + Playwright e2e — chạy song song ([d97d345](https://github.com/minhduchd-mds/desygn-ai/commit/d97d34539e62e57449dab133b9f4f6b803cd10ce))
* extract hooks from main.tsx + wire Groq LLM into agents ([e797166](https://github.com/minhduchd-mds/desygn-ai/commit/e797166490f05fbd107001c71a8dbbf468e0d727))
* **figma-adapter:** detect interactivity + motion from prototype reactions ([7e630e6](https://github.com/minhduchd-mds/desygn-ai/commit/7e630e67487c1975f1341535383c4dd37a756f90))
* FixApprovalUI component + E2E self-improvement loop test ([0956225](https://github.com/minhduchd-mds/desygn-ai/commit/095622507f70ba458d75eb352eb17f6174570c5c))
* P4 add MCP server for AI coding agents ([22bdbb4](https://github.com/minhduchd-mds/desygn-ai/commit/22bdbb431565c458267a8905f580b814749e0500))
* Plugin SDK, i18n framework, npm workspaces monorepo ([57bac1f](https://github.com/minhduchd-mds/desygn-ai/commit/57bac1fa5dcbd8aa915951742d26a7d726a0333e))
* **project:** link sessions to projects, scoped context, and ZIP export ([c60abd9](https://github.com/minhduchd-mds/desygn-ai/commit/c60abd9cb8ba10570007ba2c379a45d7fccd0625))
* release-please automation, Dependabot, contributor onboarding ([21e6eba](https://github.com/minhduchd-mds/desygn-ai/commit/21e6ebafa5acfa9745497dc5ffe5f72b462912bb))
* Sprint A+B+C — 9 new agents across command, map, safety fleets ([a221a1a](https://github.com/minhduchd-mds/desygn-ai/commit/a221a1aa19829c7a17f44e07f2c62da414dafb13))
* Sprint D — ConflictResolverAgent + ArchitectureDriftAgent ([5d95b98](https://github.com/minhduchd-mds/desygn-ai/commit/5d95b98fd6e6c264b99f2c92852847ada47f53ba))
* Storybook GitHub Pages deploy + a11y addon config ([d48bb3e](https://github.com/minhduchd-mds/desygn-ai/commit/d48bb3eafbd21da4c3a558eaf125776cbea6efaa))
* Supabase RBAC migration, seed data, local setup script, good-first-issues ([7f19b1d](https://github.com/minhduchd-mds/desygn-ai/commit/7f19b1db5f0cc043fc1e5a20dc9323c41cc2210c))
* Tier 2-3 LLM integration + security patches (v5.1.1) ([dfe3b2e](https://github.com/minhduchd-mds/desygn-ai/commit/dfe3b2e2cfd11d4b95062f039234496992663079))
* **ui:** A/B/C/D — stories, 3 more primitives, dashboard dogfood, READMEs ([d2ee102](https://github.com/minhduchd-mds/desygn-ai/commit/d2ee102aec29e3ca47aae716713dd716e63c5ede))
* **ui:** Dialog + Select primitives — Week 2 design system complete (10/10) ([672ed23](https://github.com/minhduchd-mds/desygn-ai/commit/672ed23284df19e3441b0aa34e7db6418a395244))
* **ui:** PWA install, QR code, responsive breakpoints, animations ([f205cca](https://github.com/minhduchd-mds/desygn-ai/commit/f205cca35aa669e5316df94ab5d74bbbeeca9479))
* **ui:** Week 2 dependency-free accessible primitives ([e4222ff](https://github.com/minhduchd-mds/desygn-ai/commit/e4222ff6db6978e5c991090a839a5a1cc05459c5))
* **usage:** add token metering, hourly burn rate, and cost tracking ([a0d7f75](https://github.com/minhduchd-mds/desygn-ai/commit/a0d7f75c99483921f6c5d6f9011cb1a36406c906))
* Week 0 scaffolding for Desygn A11y Move 1 ([f1df1cf](https://github.com/minhduchd-mds/desygn-ai/commit/f1df1cfdef3bf2898aff2517ddba2ac2d39f4b68))


### Bug Fixes

* **api:** resolve Gemini models returning no response ([aa95ef3](https://github.com/minhduchd-mds/desygn-ai/commit/aa95ef3e4599a15b7c1291770d4c3133a4fb3183))
* **chat-stream:** detect silent AI SDK stream closure on provider error ([2825c48](https://github.com/minhduchd-mds/desygn-ai/commit/2825c48aa65260a3399a04ccd86b3e0883814538))
* **chat-stream:** remove withRateLimitEdge wrapper that breaks streaming ([92d9875](https://github.com/minhduchd-mds/desygn-ai/commit/92d987503617b16a1d4a91d70837d09003e57a0f))
* **chat-stream:** use AI SDK v6 usage property names ([8674387](https://github.com/minhduchd-mds/desygn-ai/commit/86743879b167620ae908d2295b42011e2bf2e42c))
* **chat-stream:** use TransformStream for edge-compatible error streaming ([fac5bf3](https://github.com/minhduchd-mds/desygn-ai/commit/fac5bf337d9a013f5c5e09a1f179cf434c316f5a))
* **chat:** enable image display in AI responses and multimodal input ([bf3b246](https://github.com/minhduchd-mds/desygn-ai/commit/bf3b246fc9105db0d5389b831aa7b2f27a447f1a))
* **chat:** surface AI provider errors instead of showing empty bubbles ([a58ad72](https://github.com/minhduchd-mds/desygn-ai/commit/a58ad72253c12355a04d4370652d213849624b82))
* make prepare script CI-safe for Vercel builds ([de71167](https://github.com/minhduchd-mds/desygn-ai/commit/de71167fe2f1111d3fe752558b0f70e09985eb01))
* P0-P1 code review fixes — MCP protocol, sanitize, naming ([9711a92](https://github.com/minhduchd-mds/desygn-ai/commit/9711a92a5156eaf98df987a05a372769624b1b3d))
* P2 security hardening — Upstash rate limit, EXIF stripping, PBKDF2 600k ([2162a64](https://github.com/minhduchd-mds/desygn-ai/commit/2162a64f98d724e794339f7bf7f75364b81022d4))
* resolve 4 bugs from full project audit ([b60c10d](https://github.com/minhduchd-mds/desygn-ai/commit/b60c10d24c73fd088a91d23aee1bf45d66c46ba0))
* **security:** patch all 9 vulnerabilities via npm overrides ([506d345](https://github.com/minhduchd-mds/desygn-ai/commit/506d345276d419c6d526cc748c39ad9346280337))
* separate Chat/Code messages, fix ChatEngine signature, add Agent API ([f3b87d8](https://github.com/minhduchd-mds/desygn-ai/commit/f3b87d82feb530567a4911231722d9e950969ed4))
* **types:** widen CORS types + scope npm overrides to avoid ESLint breakage ([353e1b1](https://github.com/minhduchd-mds/desygn-ai/commit/353e1b13fc304446f8597e916006cb93600a1d8c))
* **ui:** 6 bugs — session persist, empty chat, history, username align ([5e980c3](https://github.com/minhduchd-mds/desygn-ai/commit/5e980c3e48a2740bd087d0cf059c45831c96974f))
* **ui:** move Install App section to top of landing page (after hero) ([088cef0](https://github.com/minhduchd-mds/desygn-ai/commit/088cef04f531438c14d6f80009ee011516c02ea7))
* **ui:** P0 sidebar collapse, QR code, chat history, and settings ([fea309d](https://github.com/minhduchd-mds/desygn-ai/commit/fea309d9b44630247ca516094cc83e7e7de1d78a))
* **ui:** strip legacy placeholder messages from persisted chat history ([57aee60](https://github.com/minhduchd-mds/desygn-ai/commit/57aee6098fc28929cb8d48a6caac09d1bad8006f))

## [Unreleased]

### Them moi

- **Desygn A11y Move 1 — Week 0 scaffolding** (Accessibility-as-a-Service):
  - `packages/audit-engine` — WCAG rule engine with 7 rules (contrast,
    touch-target, aria, keyboard, heading, motion, semantic), severity-weighted
    scoring, parallel execution with per-rule timeout + error isolation
  - `packages/report-generator` — Markdown / SARIF v2.1.0 / CSV exporters +
    HMAC-SHA256 report signing with constant-time verification
  - `packages/figma-rest-adapter` — server-side Figma REST client, LRU cache,
    document-tree → AuditNode transformer, URL parser
  - `packages/ui` — shared design system: OKLCH tokens (light + dark),
    spacing/radius/motion scales, prefers-reduced-motion support
  - `apps/a11y-dashboard` + `apps/marketing` — Vite + React 19 app skeletons
  - Supabase migrations 005-008 (files only): subscriptions, a11y extensions,
    audit queue, API keys
  - `docs/architecture-v6/` — full 12-week implementation spec + SCOPE_SUMMARY
  - **97 new unit tests** for the audit pipeline core
- **MCP server** (`packages/mcp-server`) — Model Context Protocol stdio server
  exposing design-system context to AI coding agents (5 tools, 39 tests)

### Thay doi

- Package slug renamed `design-md-ai` → `desygn-ai` (P1 deferred), repo URLs
  updated across docs + code (GitHub repo renamed to `desygn-ai`)
- npm workspaces: added 7 new entries (5 packages + 2 apps)
- Total test count: 1577 → 1750 (122 files)

### Bao mat

- Upstash Redis rate limiting (replaces in-memory limiter), EXIF stripping on
  image upload, PBKDF2 iterations bumped to 600k (OWASP 2023)

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
