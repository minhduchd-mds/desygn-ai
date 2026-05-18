# Copilot / Coding Agent Instructions

This repo is a TypeScript + React + Vite project with:
- Figma plugin (plugin/ — sandbox, no DOM)
- Web workspace (web/src/ — React + Vite)
- Vercel API routes (api/)
- Agentic UI/UX Auditor (web/src/ux-checklist/)
- Design.md generation engine (web/src/design-engine/)
- Shared Zod schemas (shared/schemas/)

## Rules
- Do not add more logic to `web/src/main.tsx` — it is an entry point only.
- Put checklist/audit code under `web/src/ux-checklist/`.
- Put API schemas under `shared/schemas/`.
- Validate all AI outputs with Zod schemas from `shared/schemas/`.
- Do not expose API keys in frontend or plugin code.
- All external AI calls must go through server API routes (`api/`).
- Keep UI accessible (WCAG 2.2).
- Add tests for all non-trivial logic.
- CSS Modules per component. Dark theme only. Gap-based layout.
- Never call Figma API in loops — batch everything.
- Never use `findAll()` — use `findAllWithCriteria()` on `currentPage` only.
- Scoring modules: pure functions, no side effects, no Figma API.
- Sanitize all prompt text via `shared/sanitize.ts`.

## Required commands before committing
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Architecture
See `docs/DEV_GUIDE.md` for full architecture guide.
