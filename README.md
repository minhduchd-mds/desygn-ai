> 🌐 [English](README.en.md) | **Tiếng Việt**

# Desygn AI

> AI-Powered Design Intelligence Platform — tự động audit UI/UX, sinh code từ design, và học hỏi từ mỗi dự án.

[![CI](https://github.com/minhduchd-mds/Design-md-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/minhduchd-mds/Design-md-ai/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/design-md-ai.svg)](https://www.npmjs.com/package/design-md-ai)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-1313%20passed-brightgreen.svg)]()
[![Vercel](https://img.shields.io/badge/deploy-Vercel-black.svg)](https://design-md-ai-yd6r.vercel.app/)
[![v5 Agentic](https://img.shields.io/badge/architecture-v5%20Agentic-blueviolet.svg)]()
[![Discussions](https://img.shields.io/github/discussions/minhduchd-mds/Design-md-ai)](https://github.com/minhduchd-mds/Design-md-ai/discussions)

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Hệ thống Agent (v5)](#hệ-thống-agent-v5)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tính năng](#tính-năng)
- [Cài đặt & Vận hành](#cài-đặt--vận-hành)
- [API Endpoints](#api-endpoints)
- [Thư viện Template](#thư-viện-template)
- [Kiểm thử & Chất lượng](#kiểm-thử--chất-lượng)
- [Triển khai](#triển-khai)
- [Cấu hình](#cấu-hình)
- [Tài liệu kỹ thuật](#tài-liệu-kỹ-thuật)
- [Giấy phép](#giấy-phép)

---

## Tổng quan

Desygn AI là nền tảng trí tuệ thiết kế kết nối Figma với AI coding agents. Hệ thống gồm 3 surface chính:

| Surface | Mục đích |
|---------|----------|
| **Figma Plugin** | Quét component, variables, responsive variants — chấm điểm AI-readiness |
| **Web Workspace** | Sinh Design.md, chat AI, preview handoff, template library, audit UI/UX |
| **Agent System** | 6 AI agents tự động audit, scoring, fix planning, tạo GitHub Issues |

---

## Kiến trúc hệ thống

### Tổng quan kiến trúc v5

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DESYGN AI PLATFORM v5                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │ Figma Plugin│   │ Web App     │   │ API Layer   │   │ Agent System│ │
│  │ (Sandbox)   │──▶│ (React+Vite)│──▶│ (Serverless)│──▶│ (Shannon v3)│ │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘ │
│         │                  │                  │                  │        │
│         ▼                  ▼                  ▼                  ▼        │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    INTELLIGENCE LAYER                                │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  Shannon Engine ─── GOAP Planner ─── Evidence Memory (HNSW)        │ │
│  │  PII Scanner ────── Usage Analytics ── Collaboration CRDT          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│         │                  │                  │                  │        │
│         ▼                  ▼                  ▼                  ▼        │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    UX CHECKLIST AUDITOR (v5)                         │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  AuditAgent → ScoreAgent → RecommendAgent → IssueWriter → CIGate  │ │
│  │  MemoryAgent (cross-project) ── LearningLoop (sigmoid decay)       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Nguyên tắc kiến trúc

- **Plugin sandbox**: Không DOM, không fetch — chỉ Figma API
- **UI iframe**: Không `figma.*` — chỉ `parent.postMessage`
- **Giao tiếp**: Typed `PluginMessage` qua postMessage
- **Scoring**: Pure functions — không side effects, không Figma API
- **Bảo mật**: Sanitize tất cả prompt text, PII detection tự động
- **State**: `useSyncExternalStore` với localStorage persistence

---

## Hệ thống Agent (v5)

### Pipeline xử lý

```
Figma Plugin ──scan──▶ DesignAuditAgent ──▶ AccessibilityAgent
                            │                      │
                            ▼                      ▼
                       ScoreAgent ◄──── DesignSystemAgent
                            │
                            ▼
                    ┌───────┴───────┐
                    ▼               ▼
             FixPlannerAgent   RecommendAgent
                    │               │
                    ▼               ▼
             IssueWriterAgent   CIGate
             (GitHub Issues)    (Block deploy)
                    │               │
                    ▼               ▼
              PRAutomation     DeployGate
              (Draft PRs)     (Vercel/Slack)
                    │
                    ▼
              MemoryAgent
           (Learn + Persist)
```

### Danh sách Agents

| Agent | Vai trò | Khả năng |
|-------|---------|----------|
| **DesignAuditAgent** | Analyzer | Chấm UI/UX theo 19+ criteria, multi-category |
| **AccessibilityAgent** | Analyzer | WCAG 2.2: contrast, touch target, ARIA, focus, headings |
| **DesignSystemAgent** | Analyzer | Token coverage, naming, variant, spacing grid |
| **ScoreAgent** | Validator | Bayesian calibration với historical evidence |
| **RecommendAgent** | Optimizer | GOAP-planned improvement paths |
| **FixPlannerAgent** | Optimizer | Fix plans với risk assessment, code change suggestions |
| **IssueWriterAgent** | Generator | GitHub issues với evidence + acceptance criteria |
| **MemoryAgent** | Orchestrator | Cross-project learning, semantic recall, GDPR forget |

### Self-Learning Loop

1. Agent đánh giá criterion → `AuditResult`
2. `ScoreAgent` calibrate bằng Bayesian + historical evidence
3. `LearningLoop` lưu vào Evidence Memory (HNSW vector search)
4. User feedback (agree/disagree/irrelevant) → điều chỉnh criterion weights
5. Sigmoid decay trên evidence chưa validate (knowledge half-life)
6. Audit tiếp theo sử dụng calibrated weights → scoring chính xác hơn

### CI/CD Integration

- **CIGate**: Block deploy nếu audit score < threshold
- **SARIF v2.1.0**: Tương thích GitHub Code Scanning
- **GitHub Actions**: Template workflow tự động
- **DeployGate**: Vercel/Netlify blocking + Slack notifications

---

## Cấu trúc dự án

```
Design-md-ai/
├── api/                              # Vercel serverless functions
│   ├── chat.ts                       #   Groq AI chat endpoint
│   ├── generate-html.ts              #   HTML generation
│   ├── generate-screens.ts           #   Screen generation
│   ├── analyze-image.ts              #   Image analysis
│   └── lib/sanitize.ts               #   Input sanitization
│
├── plugin/                           # Figma plugin (sandbox)
│   ├── code.ts                       #   Entry point
│   ├── serializer.ts                 #   Node serialization (isMixed checks)
│   └── handlers/                     #   Auto-layout, fixes, profiles
│
├── shared/                           # Shared code (plugin + UI + web)
│   ├── types.ts                      #   SerializedNode, PluginMessage
│   ├── viewport.ts                   #   Viewport classification
│   └── designContext.ts              #   DesignContext types
│
├── ui/                               # Figma plugin React UI (iframe)
│   ├── App.tsx                       #   Root component
│   ├── components/                   #   38 UI components (CSS Modules)
│   ├── hooks/                        #   Custom React hooks
│   └── lib/                          #   Scanner, scoring, prompt gen
│
├── web/src/                          # Web workspace (Desygn AI)
│   ├── main.tsx                      #   App entry
│   ├── ai-layer/                     #   AI experiment orchestration
│   │   └── index.ts                  #     6 built-in experiments, A/B testing
│   ├── app-shell/                    #   Toast, theme, global config
│   ├── auth/                         #   Session controller + TTL watchdog
│   ├── chat-engine/                  #   AI chat + provider abstraction
│   ├── design-engine/                #   Design.md generation + validation
│   ├── workspace-store/              #   Reactive state (useSyncExternalStore)
│   │   ├── index.ts                  #     Store<T>, workspaceStore, projectStore
│   │   └── useStore.ts               #     React hook adapter
│   ├── ux-checklist/                 #   Agentic UI/UX Auditor v5
│   │   ├── index.ts                  #     Orchestrator + CriteriaRegistry + LearningLoop
│   │   ├── agents.ts                 #     5 specialized agents
│   │   ├── github.ts                 #     GitHub Issue/PR bridge
│   │   ├── stream.ts                 #     Real-time streaming + React hook
│   │   ├── memory.ts                 #     Cross-project learning + persistence
│   │   └── ci.ts                     #     CI gate + SARIF + Deploy gate
│   ├── lib/                          #   AI Intelligence Engines
│   │   ├── shannonEngine.ts          #     Multi-agent orchestrator (6 agents)
│   │   ├── evidenceMemory.ts         #     HNSW vector search + sigmoid decay
│   │   ├── goapPlanner.ts            #     Goal-Oriented Action Planning (A*)
│   │   ├── goapShannonBridge.ts      #     GOAP → Shannon → Evidence pipeline
│   │   ├── piiDetection.ts           #     PII scanner (Luhn, SSN, VN IDs)
│   │   ├── usageAnalytics.ts         #     SaaS tiers, quotas, feature flags
│   │   ├── collaborationEngine.ts    #     CRDT (LWW + OR-Set) + PII
│   │   ├── designAnalyzer.ts         #     Design auditor (WCAG 2.2)
│   │   └── __tests__/                #     69 test files
│   ├── design/                       #   Template registry + validators
│   │   └── design-md-templates/      #     73 stored DESIGN.md templates
│   └── workspace/                    #   UI components (SplitView, Chat, etc.)
│
├── docs/                             #  Tài liệu kỹ thuật
│   ├── DEV_GUIDE.md                  #     Hướng dẫn phát triển chi tiết
│   └── adr/                          #     Architecture Decision Records
│       ├── 001-dual-mode-auth.md
│       ├── 002-event-driven-architecture.md
│       ├── 003-api-layer-architecture.md
│       └── 004-command-pattern-undo-redo.md
│
├── e2e/                              #  E2E tests (Playwright)
│   └── chat.spec.ts
│
├── .vscode/launch.json               # IDE configurations
├── vercel.json                       # Deployment + security headers
├── vite.web.config.ts                # Web build config
├── vitest.config.ts                  # Test config
└── tsconfig.json                     # TypeScript config
```

---

## Tính năng

> **Hệ thống phân loại trạng thái:**
> - 🟢 **Đã triển khai** — Production-ready, có test coverage, đã kiểm chứng trên production
> - 🟡 **Thử nghiệm** — Code hoàn chỉnh, có unit tests, chưa kiểm chứng trên production
> - 🔴 **Kế hoạch** — Chưa triển khai, nằm trong roadmap

### 🟢 Đã triển khai (Production-Ready)

**Figma Plugin**
- Quét frame/component → chấm điểm AI-readiness (0-100) theo 6 chiều: Structure, Naming, Completeness, Meta, Color, Typography
- Batch scan nhiều selections cùng lúc
- Auto-layout detection + fix suggestions (60% confidence threshold)
- Quick fixes cho các vấn đề phổ biến
- Export compact prompts cho coding agents (Figma-to-code)

**Web Workspace**
- **Chat tab** — Groq AI (Llama 3.3 70B), markdown rendering, syntax highlighting
- **Code tab** — Design.md generation với full tool suite
- **SplitView Editor** — Soạn markdown, preview, outline, word count, screen completion
- **73 Design.md templates** với lazy-loading và category filtering

**Design System & Detection**
- Design System Profiles — import từ Figma Variables, Styles, Components
- Responsive viewport detection (mobile/tablet/desktop)
- Atomic design classification (atom → page)
- Token mapping (Figma Variables → CSS custom properties)
- EN/VI internationalization

**Hạ tầng & Chất lượng**
- 1192 unit tests / 69 files (Vitest)
- GitHub Actions CI (lint + test + build + E2E)
- Vercel deployment với security headers (CSP, HSTS, X-Frame-Options)
- Local demo auth (localStorage-based)

### 🟡 Thử nghiệm (Implemented — Chưa Production-Validated)

**AI Intelligence Engines**
- **Shannon Engine v3** — 6 multi-agents, PII-aware execution
- **Evidence Memory** — HNSW vector search O(log n), sigmoid decay, contradiction detection
- **GOAP Planner** — A* search, plan caching, dynamic costs, replanning
- **PII Detection** — Luhn credit card, SSN, Vietnamese CCCD/CMND/phone, email

**Agentic UI/UX Auditor (v5)**
- 8 agents tự động audit, scoring, fix planning, tạo GitHub Issues
- AI checklist scoring (19 criteria)
- Self-learning loop với Bayesian calibration + user feedback
- Cross-project learning — pattern detection, weight aggregation, knowledge export

**Collaboration & Analytics**
- Collaboration CRDT (LWW + OR-Set)
- Usage Analytics — 4 SaaS tiers, feature flags, quota enforcement
- CI Gate / Deploy Gate — block deploy nếu audit score < threshold, SARIF v2.1.0

### 🔴 Kế hoạch (Roadmap)

| Tính năng | Mô tả |
|-----------|-------|
| Real authentication | Supabase Auth — thay thế localStorage demo hiện tại |
| Redis/KV rate limiting | Thay thế in-memory rate limiting |
| GitHub PR automation | Tự động tạo issue + coding agent workflow |
| Team workspace | Multi-user collaboration workspace |
| Enterprise RBAC | Phân quyền doanh nghiệp |
| Template marketplace | Cộng đồng chia sẻ Design.md templates |
| Self-hosted editions | Triển khai on-premise |
| Playwright web audit API | Audit UI/UX trực tiếp trên web |
| Sentry/observability | Error tracking + performance monitoring |

---

## Cài đặt & Vận hành

### Yêu cầu hệ thống

| Thành phần | Phiên bản |
|------------|-----------|
| Node.js | 20+ |
| npm | 10+ |
| Figma Desktop | Mới nhất (cho plugin dev) |

### Cài đặt

```bash
git clone https://github.com/minhduchd-mds/Design-md-ai.git
cd Design-md-ai
npm ci
```

### Chạy ứng dụng

```bash
# Web workspace (port 5174)
npm run web:dev

# Figma plugin (watch mode)
npm run dev

# Web workspace (port 5173 — alternative)
npm run dev:web
```

### Build production

```bash
npm run build       # Figma plugin → dist/
npm run web:build   # Web app → public/
```

### Scripts đầy đủ

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Watch mode: Figma plugin (UI + controller) |
| `npm run dev:web` | Web workspace dev server (port 5173) |
| `npm run web:dev` | Web workspace dev server (port 5174) |
| `npm run web:build` | Production build cho web app |
| `npm run build` | Production build cho Figma plugin |
| `npm test` | Chạy 1192 unit tests (Vitest) |
| `npm run lint` | ESLint 9 |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type checking (UI + plugin) |
| `npm run storybook` | Storybook dev server (port 6006) |

---

## API Endpoints

Vercel serverless functions trong `api/`:

| Route | Method | Mô tả |
|-------|--------|-------|
| `/api/chat` | POST | Groq AI chat (cần `GROQ_API_KEY`) |
| `/api/generate-html` | POST | Sinh HTML từ text prompt |
| `/api/generate-screens` | POST | Sinh screen layouts |
| `/api/analyze-image` | POST | Phân tích design image |

---

## Thư viện Template

**73 Design.md templates** trong `web/src/design-md-templates/`.

### Danh mục
AI, Developer, Workspace, Product, Commerce, Finance, Automotive, Media

### Sử dụng
```bash
npx getdesign@latest add <template-id>
# Ví dụ: npx getdesign@latest add airtable
```

Templates lazy-loaded — chỉ tải metadata lúc khởi động, full content khi chọn.

---

## Kiểm thử & Chất lượng

```bash
npm test              # 1192 tests / 69 files
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint 9
npm run format:check  # Prettier check
npm run typecheck     # TypeScript (UI + plugin)
```

### Phân bố tests

| Module | Số tests | Mô tả |
|--------|----------|-------|
| Core lib (Shannon, GOAP, Evidence, PII) | ~890 | Intelligence engines |
| UX Checklist (agents, CI, memory, stream) | ~72 | Agentic auditor v5 |
| Modular architecture (stores, engines) | ~68 | App modules |
| Design (templates, parser, validator) | ~50 | Design.md |
| Plugin (serializer, handlers, scoring) | ~60 | Figma plugin |
| Workspace (SplitView, helpers) | ~50 | Web UI |

### Build output

| Target | Size | Ghi chú |
|--------|------|---------|
| Figma Plugin (`dist/code.js`) | 98.6 kB | esbuild, ES6 |
| Figma UI (`dist/index.html`) | 496 kB | Vite, single-file |
| Web App (`public/`) | ~2.1 MB | Vite, code-split, 84 chunks |

---

## Triển khai

### Vercel (Production)

```json
{
  "buildCommand": "npm run web:build",
  "outputDirectory": "public",
  "installCommand": "npm ci"
}
```

**Live**: [design-md-ai-yd6r.vercel.app](https://design-md-ai-yd6r.vercel.app/)

Security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy (cấu hình trong `vercel.json`).

### Figma Plugin

1. `npm run build`
2. Figma Desktop → `Ctrl+Shift+P` → **Import plugin from manifest**
3. Chọn `manifest.json` trong repo

---

## Cấu hình

### Biến môi trường

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `GROQ_API_KEY` | Có | Groq API key cho AI chat |
| `VITE_SCREENSHOT_TO_CODE_WS_URL` | Không | WebSocket URL cho screenshot-to-code |
| `VITE_SUPABASE_URL` | Không | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Không | Supabase anonymous key |

---

## Tài liệu kỹ thuật

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| **Hướng dẫn phát triển** | [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md) | Kiến trúc chi tiết, module map, agent pipeline, hard rules |
| **ADR: Dual-Mode Auth** | [`docs/adr/001`](docs/adr/001-dual-mode-auth.md) | Quyết định kiến trúc authentication |
| **ADR: Event-Driven** | [`docs/adr/002`](docs/adr/002-event-driven-architecture.md) | Event bus architecture |
| **ADR: API Layer** | [`docs/adr/003`](docs/adr/003-api-layer-architecture.md) | API design decisions |
| **ADR: Command Pattern** | [`docs/adr/004`](docs/adr/004-command-pattern-undo-redo.md) | Undo/redo implementation |
| **Bảo mật** | [`SECURITY.md`](SECURITY.md) | Security policy + PII protection |
| **Changelog** | [`CHANGELOG.md`](CHANGELOG.md) | Lịch sử phiên bản |
| **Contributing** | [`CONTRIBUTING.md`](CONTRIBUTING.md) | Hướng dẫn đóng góp |

---

## Giấy phép

[MIT](LICENSE)
