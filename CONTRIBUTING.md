# Contributing to DesignReady.ai

Thank you for your interest in contributing to DesignReady.ai! This guide will help you get started.

## Prerequisites

- Node.js 20+
- npm 10+
- Git

## Getting Started

```bash
git clone https://github.com/minhduchd-mds/Design-md-ai.git
cd Design-md-ai
npm install
npm run dev
```

## Project Structure

```
plugin/     Figma sandbox (no DOM, no fetch). Only Figma API.
ui/         React iframe (no figma.*). Only parent.postMessage.
web/        Marketing site + workspace app (Vite + React)
shared/     Shared types and utilities
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode (UI + plugin) |
| `npm run web:dev` | Web workspace dev server |
| `npm run build` | Production build |
| `npm test` | Run all tests (Vitest) |
| `npm run lint` | ESLint 9 |

## Branch Naming

- `feat/short-description` - New features
- `fix/short-description` - Bug fixes
- `docs/short-description` - Documentation
- `refactor/short-description` - Code refactoring

## Commit Convention

We use conventional commits:

```
feat: add mobile viewport analysis
fix: resolve SCSS variable undefined error
docs: update architecture diagram
refactor: extract ComparePanel from main.tsx
test: add Shannon engine unit tests
```

## Code Style

- TypeScript strict mode
- CSS Modules (`.module.scss`) for component styles
- Never call Figma API in loops (batch everything)
- Never use `findAll()` (use `findAllWithCriteria()`)
- Scoring modules: pure functions, no side effects
- Sanitize prompt text via `sanitize.ts`

## Testing

All new features must include tests:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes with tests
4. Ensure `npm test` and `npm run lint` pass
5. Submit a PR with a clear description
6. Wait for review

## Architecture Notes

- **Shannon Engine**: Multi-agent pipeline (Analyzer, Generator, Validator, Optimizer)
- **Provider Router**: Smart model selection (Groq 8B for validation, 70B for generation)
- **Communication**: Typed `PluginMessage` via postMessage between plugin and UI
- **State**: React hooks with localStorage persistence

## Questions?

Open a GitHub Discussion or Issue for help.
