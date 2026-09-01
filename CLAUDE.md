# Desygn AI — Claude Code Instructions

> Full dev guide: [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)

## Commands
```
npm run dev       # Watch mode (UI + plugin)
npm run build     # Production → dist/
npm test          # Vitest
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

## Agent workflow
1. Start from a product outcome, not a random file edit.
2. Map affected workspace packages, API routes, web surfaces, data contracts, tests, and deployment runtime.
3. For multi-module work, create a dependency-aware task graph and define acceptance criteria before implementation.
4. Keep audit/scoring/policy logic deterministic and explainable. AI may recommend changes but must not silently redefine metrics or standards.
5. Keep Edge-safe modules separated from Node-only dependencies; check transitive imports, not only direct imports.
6. Build workspace/shared packages before consumer applications when validating production deployment.
7. A builder must not be the sole reviewer of its own patch. Use the repository reviewer agent after implementation.
8. Do not merge around failing unit/build/security checks unless the failure is demonstrated to be infrastructure-only and recorded in the PR.

## Product direction
Design source → normalized Design IR → explainable analysis/audit → design-system intelligence → recommendation → optional implementation → independent verification/evidence.

Prefer capabilities that improve this closed loop over unrelated utility features.

## Source and license policy
External projects may be studied for architecture, workflow, standards, protocols, or public APIs. Prefer clean-room implementation for core algorithms. If implementation is adapted, record source URL, exact revision/version, license, retained notices, and modifications. Never claim a standardized mathematical transform or third-party algorithm as repository-owned.

## Repo
- **Origin:** github.com/minhduchd-mds/desygn-ai
