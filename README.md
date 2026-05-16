# Desygn AI

> Figma-to-Design.md handoff tool for AI coding agents.
> Scan design systems, generate structured specs, and prepare prompts for Codex, Claude Code, Cursor, Windsurf, and Figma Make.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)]()
[![Vercel](https://img.shields.io/badge/deploy-Vercel-black.svg)](https://design-md-ai.vercel.app/)
[![Tests](https://img.shields.io/badge/tests-157%20passed-brightgreen.svg)]()

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Features](#features)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Figma Plugin](#figma-plugin)
- [Web Workspace](#web-workspace)
- [API Routes](#api-routes)
- [Template Library](#template-library)
- [SCSS Architecture](#scss-architecture)
- [Testing & Quality](#testing--quality)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Current Limitations](#current-limitations)
- [License](#license)

---

## Overview

Desygn AI bridges the gap between design context and code generation. It provides two user-facing surfaces:

| Surface | Purpose |
|---------|---------|
| **Figma Plugin** | Scan components, variables, responsive variants, and score AI-readiness |
| **Web Workspace** | Generate Design.md, chat with Groq AI, preview handoffs, and use the template library |

---

## Architecture

The project follows a strict **sandbox separation** model:

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   Plugin Sandbox        │         │   UI Iframe             │
│   (no DOM, no fetch)    │◄───────►│   (no figma.*)          │
│                         │ postMsg │                         │
│   plugin/code.ts        │         │   ui/App.tsx            │
│   plugin/serializer.ts  │         │   ui/components/*       │
│   plugin/handlers/*     │         │   ui/hooks/*            │
└────────┬────────────────┘         └────────┬────────────────┘
         │                                   │
         ▼                                   ▼
   shared/types.ts ◄──── PluginMessage ────► shared/viewport.ts
   (message types)                           (pure utilities)

┌─────────────────────────┐         ┌─────────────────────────┐
│   Web App               │         │   API (Serverless)      │
│   web/src/main.tsx      │────────►│   api/chat.ts           │
│   web/src/scss/*        │  fetch  │   api/generate-html.ts  │
│   web/src/workspace/*   │         │   api/analyze-image.ts  │
└─────────────────────────┘         └─────────────────────────┘
```

**Key principles:**

- Plugin sandbox has **no DOM, no fetch** — only Figma API
- UI iframe has **no figma.\*** — only `parent.postMessage`
- All communication via typed `PluginMessage` (defined in `shared/types.ts`)
- Scoring modules are **pure functions** — no side effects, no Figma API
- Web workspace uses **SCSS modules** with centralized design tokens
- Prompt text always sanitized via `sanitize.ts` (injection risk prevention)

---

## Project Structure

```
Design-md-ai/
├── api/                            # Vercel serverless functions
│   ├── chat.ts                     #   Groq AI chat endpoint
│   ├── generate-html.ts            #   HTML generation from prompts
│   ├── generate-screens.ts         #   Screen generation endpoint
│   ├── analyze-image.ts            #   Image analysis endpoint
│   ├── bootstrap-context.ts        #   Context bootstrapping
│   └── lib/
│       └── sanitize.ts             #   Input sanitization utilities
│
├── plugin/                         # Figma plugin controller (no DOM, no fetch)
│   ├── code.ts                     #   Plugin entry point
│   ├── serializer.ts               #   Node serialization with isMixed() checks
│   ├── types.ts                    #   Plugin-specific types
│   └── handlers/
│       ├── autolayout.ts           #   Auto-layout analysis & fixes
│       ├── figma-import.ts         #   Figma import handler
│       ├── fixes.ts                #   Design fix suggestions
│       ├── profiles.ts             #   Scan profiles
│       ├── project-frame.ts        #   Project frame creation
│       ├── selection.ts            #   Selection handler
│       └── __tests__/              #   Handler unit tests
│
├── shared/                         # Shared code (plugin + UI + web)
│   ├── types.ts                    #   SerializedNode, PluginMessage types
│   ├── constants.ts                #   Shared constants
│   ├── designContext.ts            #   DesignContext type & factory
│   ├── viewport.ts                 #   Viewport classification utils
│   ├── sanitize.ts                 #   Shared sanitization
│   └── __tests__/                  #   Shared unit tests
│
├── ui/                             # Figma plugin React UI (iframe)
│   ├── main.tsx                    #   UI entry point
│   ├── App.tsx                     #   Root component with tab navigation
│   ├── components/                 #   38 UI components (CSS Modules)
│   │   ├── ScoreOverview.tsx       #     AI-readiness score dashboard
│   │   ├── BatchPanel.tsx          #     Batch scan results
│   │   ├── FixPanel.tsx            #     Quick-fix suggestions
│   │   ├── TokenMap.tsx            #     Color token mapping
│   │   ├── UiUxEvaluationPanel.tsx #     UI/UX evaluation (7 categories)
│   │   ├── BADocumentPanel.tsx     #     BA document editor
│   │   ├── DesignProjectPanel.tsx  #     Design system overview
│   │   ├── ProfileManager.tsx      #     Scan profile management
│   │   └── ...                     #     (+ 30 more components)
│   ├── hooks/                      #   Custom React hooks
│   ├── lib/                        #   Scanner, scoring, prompt generation
│   ├── i18n/                       #   EN/VI internationalization
│   ├── styles/                     #   Global CSS & tokens
│   └── tokens/                     #   Dark/Light design tokens (JSON)
│
├── web/                            # Public web workspace (Desygn AI)
│   └── src/
│       ├── main.tsx                #   App entry (auth, workspace, chat)
│       ├── scss/                   #   Modular SCSS architecture
│       │   ├── _variables.scss     #     Design tokens, colors, fonts
│       │   ├── _base.scss          #     Reset, root, scrollbar
│       │   ├── _landing.scss       #     Landing page & hero
│       │   ├── _sidebar.scss       #     Auth, nav, history
│       │   ├── _workspace.scss     #     Tabs, theme toggle, builder
│       │   ├── _chat.scss          #     Messages, markdown, code
│       │   ├── _welcome.scss       #     Welcome hero & cards
│       │   ├── _plan.scss          #     Pricing, auth forms
│       │   ├── _templates.scss     #     Template modal
│       │   ├── _checklist.scss     #     Checklist panel & setup
│       │   ├── _toast.scss         #     Toast notifications
│       │   ├── _modals.scss        #     Detail/report modals
│       │   ├── _compare.scss       #     Compare panel & PDF
│       │   └── styles.scss         #     Entry point (@use all)
│       ├── app/
│       │   └── types.ts            #   App-level TypeScript types
│       ├── design/
│       │   ├── templateRegistry.ts #   73 template registry + metadata
│       │   ├── designParser.ts     #   Design.md parser & builder
│       │   ├── contextBuilder.ts   #   Design context builder
│       │   ├── layoutValidator.ts  #   Layout validation & scoring
│       │   ├── screenGenerator.ts  #   Screen generation logic
│       │   ├── templateMatcher.ts  #   Template matching engine
│       │   └── __tests__/          #   Design module tests
│       ├── design-md-templates/    #   73 stored DESIGN.md templates
│       └── workspace/
│           ├── ChatComposer.tsx    #   Chat input with controls
│           ├── SplitView.tsx       #   Split view editor
│           ├── HtmlPreviewModal.tsx#   HTML preview modal
│           ├── ComparePanel.tsx    #   Design vs. code comparison
│           ├── claudeChat.ts       #   Groq AI chat client
│           ├── fileImport.ts       #   Markdown/ZIP import
│           ├── imageAnalyzer.ts    #   Image analysis client
│           └── screenshotToCode.ts #   Screenshot-to-code WS client
│
├── supabase/                       # Supabase config
│   ├── functions/
│   │   └── analyze-image/          #   Edge function for image analysis
│   └── migrations/
│       └── 001_project_versions.sql
│
├── manifest.json                   # Figma plugin manifest
├── package.json                    # Dependencies & scripts
├── vercel.json                     # Vercel deployment & security headers
├── vite.config.ts                  # Figma plugin UI build config
├── vite.web.config.ts              # Web workspace build config
├── vitest.config.ts                # Test configuration
├── tsconfig.json                   # TypeScript config (UI)
└── tsconfig.plugin.json            # TypeScript config (plugin)
```

---

## Features

### Figma Plugin
- Scan selected frames/components and score AI-readiness (0-100)
- 7-category evaluation: documentation, guidelines, testing, color, accessibility, states, icons
- Batch scan multiple selections at once
- Read Figma variables, paint styles, components, component sets
- Auto-layout detection and fix suggestions
- Color token mapping (Figma Variables → CSS custom properties)
- Responsive variant detection (mobile/tablet/desktop)
- Atomic design level classification (atom → page)
- Export compact prompts for coding agents
- Design project frame creation with mapped metadata
- EN/VI internationalization

### Web Workspace
- **Chat tab** — Groq AI conversation (Llama 3.3 70B), full markdown rendering with syntax highlighting
- **Code tab** — Design.md generation with complete tool suite
- **73 Design.md templates** with lazy-loading and category filtering
- Dark/Light theme toggle
- Design.md inline editor with preview, section navigation
- Import `.md`, `.markdown`, `.txt`, `.zip` files
- Screenshot-to-code generation (requires backend)
- Design vs. code comparison panel with bug markers
- BA (Business Analysis) document editor with template
- Checklist panel for design handoff tracking
- Local demo auth with Web Crypto encryption
- ErrorBoundary for graceful crash recovery

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **npm**
- **Figma Desktop** (for plugin development)

### Install

```bash
npm ci
```

### Run Web App

```bash
npm run web:dev
# → http://127.0.0.1:5174
```

### Run Figma Plugin (dev)

```bash
npm run dev
# Watches both plugin UI and controller
```

### Build Everything

```bash
# Figma plugin → dist/
npm run build

# Web app → public/
npm run web:build
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode for Figma plugin (UI + controller) |
| `npm run web:dev` | Dev server for web workspace (port 5174) |
| `npm run web:build` | Production build for web app |
| `npm run build` | Production build for Figma plugin |
| `npm test` | Run 157 unit tests (Vitest) |
| `npm run lint` | ESLint 9 |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type checking (UI + plugin) |
| `npm run storybook` | Storybook dev server (port 6006) |
| `npm run package` | Build + package plugin for release |

---

## Figma Plugin

### Setup

1. Build the plugin:
   ```bash
   npm run build
   ```
2. Open **Figma Desktop**
3. `Ctrl+Shift+P` (Windows) / `Cmd+Shift+P` (macOS)
4. Search **Import plugin from manifest**
5. Select this repository's `manifest.json`
6. Open a design file → **Plugins → Development → Design-md-ai**

### Plugin Tabs

| Tab | Purpose |
|-----|---------|
| **Scan** | Scan selected component, view score, quick fixes, token map, responsive variants |
| **Design** | Design system overview with UI/UX evaluation panel |

### Scoring Categories

| Category | What it measures |
|----------|-----------------|
| Structure | Auto-layout adoption, nesting depth |
| Naming | BEM/semantic naming conventions |
| Completeness | Required variant coverage |
| Meta | Component descriptions, documentation |
| Color | Semantic tokens, dark mode support |
| Typography | Font scale, heading/body hierarchy |

---

## Web Workspace

### Tab System

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Chat** | Groq AI conversation | Markdown rendering, code highlighting, streaming |
| **Code** | Design.md generation | Image analysis, BA docs, screen gen, templates |

### Theme

Dark (default) and Light themes via toggle. All workspace elements respond to the active theme.

### Auth

Local-demo only with Web Crypto encryption. User records stored in `localStorage`. Use a real backend auth system for production.

---

## API Routes

Vercel serverless functions in `api/`:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Groq AI chat (requires `GROQ_API_KEY`) |
| `/api/generate-html` | POST | Generate HTML from text prompt |
| `/api/generate-screens` | POST | Generate screen layouts |
| `/api/analyze-image` | POST | Analyze uploaded design image |

---

## Template Library

**73 Design.md templates** in `web/src/design-md-templates/`.

Registry: `web/src/design/templateRegistry.ts`

### Categories

AI, Developer, Workspace, Product, Commerce, Finance, Automotive, Media

### Usage

```bash
npx getdesign@latest add <template-id>
# Example: npx getdesign@latest add airtable
```

Templates are lazy-loaded — only metadata at startup, full content on selection.

---

## SCSS Architecture

The web workspace uses a modular SCSS system with 14 partials:

```
web/src/scss/
├── _variables.scss     # Design tokens ($purple-500, $dark-900, fonts, shadows, radii)
├── _base.scss          # :root, resets, scrollbar, body
├── _landing.scss       # Landing page, hero, features, metrics
├── _sidebar.scss       # Auth panel, brand header, nav, history
├── _workspace.scss     # Tab switcher, theme toggle, builder
├── _chat.scss          # Messages, markdown, code blocks, streaming
├── _welcome.scss       # Welcome hero, action cards
├── _plan.scss          # Plan cards, pricing, auth forms
├── _templates.scss     # Template popup modal
├── _checklist.scss     # Checklist panel, tables, setup modal
├── _toast.scss         # Toast notifications
├── _modals.scss        # Detail/report modals, badges
├── _compare.scss       # Compare panel, bug markers, PDF export
└── styles.scss         # Entry point — @use all partials
```

All partials use `@use "variables" as *` for access to shared tokens. The Figma plugin UI uses CSS Modules per component instead.

---

## Testing & Quality

```bash
npm test              # 157 tests across 20 files
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run lint          # ESLint 9 (0 errors, 5 warnings)
npm run format:check  # Prettier check
npm run typecheck     # TypeScript (UI + plugin)
npm run storybook     # Component playground
```

### Build Output

| Target | Size | Notes |
|--------|------|-------|
| Figma Plugin (`dist/code.js`) | 98.6 kB | esbuild, ES6 target |
| Figma UI (`dist/index.html`) | 496 kB | Vite, single-file inline |
| Web App (`public/`) | — | Vite, code-split |

---

## Deployment

### Vercel

```json
{
  "buildCommand": "npm run web:build",
  "outputDirectory": "public",
  "installCommand": "npm ci"
}
```

Security headers configured in `vercel.json`: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.

### Steps

1. Push to GitHub
2. Import repository in Vercel
3. Set environment variables (see below)

### Live

- **App**: [design-md-ai.vercel.app](https://design-md-ai.vercel.app/)

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for AI chat |
| `VITE_SCREENSHOT_TO_CODE_WS_URL` | No | WebSocket URL for screenshot-to-code backend |
| `VITE_SUPABASE_URL` | No | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anonymous key |

---

## Current Limitations

- Web auth is local/demo only (not production-ready)
- Screenshot-to-code requires a separate WebSocket backend
- Pro upgrade state is local/demo logic
- Some sidebar sections (My Library, Settings) are placeholder
- Full project ZIP export is not yet implemented

---

## License

[MIT](LICENSE)
