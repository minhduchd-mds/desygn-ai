# Desygn AI — Claude Code Instructions

> Full dev guide: [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)

## Commands
```
npm run dev       # Watch mode (UI + plugin)
npm run build     # Production → dist/
npm test          # Vitest (1577 tests)
npm run lint      # ESLint 9
```

## Hard Rules
- Never call Figma API in loops — batch everything.
- Never use `findAll()` — use `findAllWithCriteria()` on `currentPage` only.
- Serializer: `isMixed()` check before reading mixed properties. Max depth 15.
- Scoring modules: pure functions, no side effects, no Figma API.
- Prompt text: always `sanitize()` via `sanitize.ts` (strips HTML + control chars). For prompt-injection defense, also use `wrapUserInput()` when embedding user text in AI prompts.
- CSS Modules per component. Dark theme only. Gap-based layout.
- New serializer field: types.ts → serializer.ts → prompt-compact.ts.

## Repo
- **Origin:** github.com/minhduchd-mds/desygn-ai
