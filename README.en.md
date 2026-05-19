> 🌐 **English** | [Tiếng Việt](README.md)

# Desygn AI

> AI-Powered Design Intelligence Platform — automated UI/UX auditing, design-to-code generation, and continuous learning across projects.

[![CI](https://github.com/minhduchd-mds/Design-md-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/minhduchd-mds/Design-md-ai/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/design-md-ai.svg)](https://www.npmjs.com/package/design-md-ai)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-1313%20passed-brightgreen.svg)]()
[![Vercel](https://img.shields.io/badge/deploy-Vercel-black.svg)](https://design-md-ai-yd6r.vercel.app/)
[![v5 Agentic](https://img.shields.io/badge/architecture-v5%20Agentic-blueviolet.svg)]()
[![Discussions](https://img.shields.io/github/discussions/minhduchd-mds/Design-md-ai)](https://github.com/minhduchd-mds/Design-md-ai/discussions)

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Agent System (v5)](#agent-system-v5)
- [Project Structure](#project-structure)
- [Features](#features)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Template Library](#template-library)
- [Testing & Quality](#testing--quality)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Technical Docs](#technical-docs)
- [License](#license)

---

## Overview

Desygn AI is a design intelligence platform that bridges Figma with AI coding agents. The system is built around three primary surfaces:

| Surface | Purpose |
|---------|---------|
| **Figma Plugin** | Scans components, variables, and responsive variants — scores AI-readiness |
| **Web Workspace** | Generates Design.md, AI chat, handoff preview, template library, UI/UX audit |
| **Agent System** | 6 AI agents for automated auditing, scoring, fix planning, and GitHub Issue creation |

---

## System Architecture

### Architecture Overview (v5)

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

### Architectural Principles

- **Plugin sandbox**: No DOM, no fetch — Figma API only
- **UI iframe**: No `figma.*` — uses `parent.postMessage` only
- **Communication**: Typed `PluginMessage` over postMessage
- **Scoring**: Pure functions — no side effects, no Figma API calls
- **Security**: All prompt text sanitized, automatic PII detection
- **State**: `useSyncExternalStore` with localStorage persistence

---

## Agent System (v5)

### Processing Pipeline

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

### Agent Roster

| Agent | Role | Capabilities |
|-------|------|-------------|
| **DesignAuditAgent** | Analyzer | Scores UI/UX across 19+ criteria, multi-category |
| **AccessibilityAgent** | Analyzer | WCAG 2.2: contrast, touch targets, ARIA, focus order, headings |
| **DesignSystemAgent** | Analyzer | Token coverage, naming conventions, variant consistency, spacing grid |
| **ScoreAgent** | Validator | Bayesian calibration with historical evidence |
| **RecommendAgent** | Optimizer | GOAP-planned improvement paths |
| **FixPlannerAgent** | Optimizer | Fix plans with risk assessment and code change suggestions |
| **IssueWriterAgent** | Generator | GitHub issues with evidence and acceptance criteria |
| **MemoryAgent** | Orchestrator | Cross-project learning, semantic recall, GDPR forget |

### Self-Learning Loop

1. Agent evaluates a criterion → produces `AuditResult`
2. `ScoreAgent` calibrates using Bayesian scoring + historical evidence
3. `LearningLoop` persists findings to Evidence Memory (HNSW vector search)
4. User feedback (agree / disagree / irrelevant) adjusts criterion weights
5. Sigmoid decay applied to unvalidated evidence (knowledge half-life)
6. Subsequent audits use calibrated weights → progressively more accurate scoring

### CI/CD Integration

- **CIGate**: Blocks deployment if audit score falls below threshold
- **SARIF v2.1.0**: Compatible with GitHub Code Scanning
- **GitHub Actions**: Ready-to-use automation workflow template
- **DeployGate**: Vercel/Netlify blocking + Slack notifications

---

## Project Structure

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
├── docs/                             #  Technical documentation
│   ├── DEV_GUIDE.md                  #     Detailed development guide
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

## Features

> **Status legend:**
> - 🟢 **Implemented** — Production-ready, test coverage verified, running in production
> - 🟡 **Experimental** — Complete code, unit tested, not yet validated in production
> - 🔴 **Roadmap** — Not yet implemented, planned for a future release

### 🟢 Implemented (Production-Ready)

**Figma Plugin**
- Scan frames/components → score AI-readiness (0–100) across 6 dimensions: Structure, Naming, Completeness, Meta, Color, Typography
- Batch scan multiple selections simultaneously
- Auto-layout detection + fix suggestions (60% confidence threshold)
- Quick fixes for common layout issues
- Export compact prompts for coding agents (Figma-to-code)

**Web Workspace**
- **Chat tab** — Groq AI (Llama 3.3 70B), markdown rendering, syntax highlighting
- **Code tab** — Design.md generation with full tool suite
- **SplitView Editor** — Markdown authoring, live preview, outline, word count, screen completion
- **73 Design.md templates** with lazy-loading and category filtering

**Design System & Detection**
- Design System Profiles — import from Figma Variables, Styles, and Components
- Responsive viewport detection (mobile / tablet / desktop)
- Atomic design classification (atom → page)
- Token mapping (Figma Variables → CSS custom properties)
- EN/VI internationalization

**Infrastructure & Quality**
- 1192 unit tests across 69 files (Vitest)
- GitHub Actions CI (lint + test + build + E2E)
- Vercel deployment with security headers (CSP, HSTS, X-Frame-Options)
- Local demo auth (localStorage-based)

### 🟡 Experimental (Implemented — Not Yet Production-Validated)

**AI Intelligence Engines**
- **Shannon Engine v3** — 6 multi-agents, PII-aware execution
- **Evidence Memory** — HNSW vector search O(log n), sigmoid decay, contradiction detection
- **GOAP Planner** — A* search, plan caching, dynamic costs, replanning
- **PII Detection** — Luhn credit card, SSN, Vietnamese CCCD/CMND/phone, email

**Agentic UI/UX Auditor (v5)**
- 8 agents for automated auditing, scoring, fix planning, and GitHub Issue creation
- AI checklist scoring (19 criteria)
- Self-learning loop with Bayesian calibration + user feedback
- Cross-project learning — pattern detection, weight aggregation, knowledge export

**Collaboration & Analytics**
- Collaboration CRDT (LWW + OR-Set)
- Usage Analytics — 4 SaaS tiers, feature flags, quota enforcement
- CI Gate / Deploy Gate — blocks deployment when audit score falls below threshold, SARIF v2.1.0

### 🔴 Roadmap

| Feature | Description |
|---------|-------------|
| Real authentication | Supabase Auth — replacing the current localStorage demo |
| Redis/KV rate limiting | Replace in-memory rate limiting |
| GitHub PR automation | Automated issue creation + coding agent workflow |
| Team workspace | Multi-user collaborative workspace |
| Enterprise RBAC | Role-based access control for enterprise |
| Template marketplace | Community-driven Design.md template sharing |
| Self-hosted editions | On-premise deployment support |
| Playwright web audit API | UI/UX auditing directly on live web pages |
| Sentry/observability | Error tracking + performance monitoring |

---

## Getting Started

### Requirements

| Dependency | Version |
|------------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Figma Desktop | Latest (for plugin development) |

### Installation

```bash
git clone https://github.com/minhduchd-mds/Design-md-ai.git
cd Design-md-ai
npm ci
```

### Running the App

```bash
# Web workspace (port 5174)
npm run web:dev

# Figma plugin (watch mode)
npm run dev

# Web workspace (port 5173 — alternative)
npm run dev:web
```

### Production Build

```bash
npm run build       # Figma plugin → dist/
npm run web:build   # Web app → public/
```

### All Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode: Figma plugin (UI + controller) |
| `npm run dev:web` | Web workspace dev server (port 5173) |
| `npm run web:dev` | Web workspace dev server (port 5174) |
| `npm run web:build` | Production build for web app |
| `npm run build` | Production build for Figma plugin |
| `npm test` | Run 1192 unit tests (Vitest) |
| `npm run lint` | ESLint 9 |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type checking (UI + plugin) |
| `npm run storybook` | Storybook dev server (port 6006) |

---

## API Endpoints

Vercel serverless functions located in `api/`:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Groq AI chat (requires `GROQ_API_KEY`) |
| `/api/generate-html` | POST | Generate HTML from a text prompt |
| `/api/generate-screens` | POST | Generate screen layouts |
| `/api/analyze-image` | POST | Analyze a design image |

---

## Template Library

**73 Design.md templates** located in `web/src/design-md-templates/`.

### Categories

AI, Developer, Workspace, Product, Commerce, Finance, Automotive, Media

### Usage

```bash
npx getdesign@latest add <template-id>
# Example: npx getdesign@latest add airtable
```

Templates are lazy-loaded — only metadata is fetched on startup; full content loads on selection.

---

## Testing & Quality

```bash
npm test              # 1192 tests / 69 files
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint 9
npm run format:check  # Prettier check
npm run typecheck     # TypeScript (UI + plugin)
```

### Test Distribution

| Module | Tests | Description |
|--------|-------|-------------|
| Core lib (Shannon, GOAP, Evidence, PII) | ~890 | Intelligence engines |
| UX Checklist (agents, CI, memory, stream) | ~72 | Agentic auditor v5 |
| Modular architecture (stores, engines) | ~68 | App modules |
| Design (templates, parser, validator) | ~50 | Design.md |
| Plugin (serializer, handlers, scoring) | ~60 | Figma plugin |
| Workspace (SplitView, helpers) | ~50 | Web UI |

### Build Output

| Target | Size | Notes |
|--------|------|-------|
| Figma Plugin (`dist/code.js`) | 98.6 kB | esbuild, ES6 |
| Figma UI (`dist/index.html`) | 496 kB | Vite, single-file |
| Web App (`public/`) | ~2.1 MB | Vite, code-split, 84 chunks |

---

## Deployment

### Vercel (Production)

```json
{
  "buildCommand": "npm run web:build",
  "outputDirectory": "public",
  "installCommand": "npm ci"
}
```

**Live**: [design-md-ai-yd6r.vercel.app](https://design-md-ai-yd6r.vercel.app/)

Security headers applied: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy (configured in `vercel.json`).

### Figma Plugin

1. `npm run build`
2. Figma Desktop → `Ctrl+Shift+P` → **Import plugin from manifest**
3. Select `manifest.json` from the repo root

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for AI chat |
| `VITE_SCREENSHOT_TO_CODE_WS_URL` | No | WebSocket URL for screenshot-to-code |
| `VITE_SUPABASE_URL` | No | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anonymous key |

---

## Technical Docs

| Document | Path | Contents |
|----------|------|----------|
| **Development Guide** | [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md) | Detailed architecture, module map, agent pipeline, hard rules |
| **ADR: Dual-Mode Auth** | [`docs/adr/001`](docs/adr/001-dual-mode-auth.md) | Authentication architecture decision |
| **ADR: Event-Driven** | [`docs/adr/002`](docs/adr/002-event-driven-architecture.md) | Event bus architecture |
| **ADR: API Layer** | [`docs/adr/003`](docs/adr/003-api-layer-architecture.md) | API design decisions |
| **ADR: Command Pattern** | [`docs/adr/004`](docs/adr/004-command-pattern-undo-redo.md) | Undo/redo implementation |
| **Security** | [`SECURITY.md`](SECURITY.md) | Security policy + PII protection |
| **Changelog** | [`CHANGELOG.md`](CHANGELOG.md) | Version history |
| **Contributing** | [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution guidelines |

---

## License

[MIT](LICENSE)
