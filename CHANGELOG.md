# Nhật ký thay đổi (Changelog)

Tất cả thay đổi quan trọng của Desygn AI được ghi nhận tại đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Phiên bản theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/designready-ai/designready-ai/compare/v5.0.0...HEAD
[5.0.0]: https://github.com/designready-ai/designready-ai/compare/v2.0.0...v5.0.0
[2.0.0]: https://github.com/designready-ai/designready-ai/compare/v1.1.5...v2.0.0
[1.1.5]: https://github.com/designready-ai/designready-ai/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/designready-ai/designready-ai/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/designready-ai/designready-ai/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/designready-ai/designready-ai/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/designready-ai/designready-ai/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/designready-ai/designready-ai/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/designready-ai/designready-ai/releases/tag/v1.0.0
