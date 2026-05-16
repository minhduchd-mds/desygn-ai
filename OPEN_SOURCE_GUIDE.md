# Open Source Guide

Welcome to DesignReady.ai — the open-source Design Intelligence Engine.

## What is DesignReady.ai?

DesignReady.ai is a Figma plugin and web workspace that transforms design files into production-ready code using AI-powered multi-agent pipelines. It bridges the gap between design and development with automated quality validation.

## Architecture Overview

The system is organized into 7 layers:

### Input Layer
- Figma (via MCP connection)
- Screenshots (Playwright capture)
- Manual Spec (Design.md format)
- Git Repo (sync and PR generation)
- Design System Registry (multi-DS hub)

### Memory Layer
- AgentMemory (4-tier persistent memory)
- Project Memory (per-project context)
- Design System Memory (pattern recognition)
- BM25 Search (fast text retrieval)
- IndexedDB / Server storage (persistence)

### Analysis Layer
- DesignAnalyzer (6-dimension scoring)
- Accessibility Audit (WCAG 2.2 compliance)
- Mobile Analyzer (viewport + touch targets)
- Framework Detector (auto-detect tech stack)
- Design-System Drift Detector (cross-system analysis)

### Shannon Engine (Multi-Agent Pipeline)
- Analyzer Agent (Groq 8B, fast pattern detection)
- Generator Agent (Groq 70B, code synthesis)
- Validator Agent (Groq 8B, quality gates)
- Optimizer Agent (Groq 8B, token efficiency)

### Provider Router
- Groq Fast Validation (8B at 40ms TTFT)
- GPT Structured Output (complex generation)
- Claude Long Reasoning (deep analysis)
- Local/Self-hosted Model (privacy-first)

### Generation Layer
- Design.md (structured handoff format)
- React TSX (production components)
- Vue SFC (Single File Components)
- Svelte 5 (runes syntax)
- Flutter/React Native (mobile)
- GitHub PR (automated pull requests)

### Platform Layer
- Template Marketplace (search, install, publish)
- Multi-DS Hub (cross-design-system management)
- Plugin SDK (extension system)
- Collaboration CRDT (real-time multi-user)

### Enterprise Layer
- SSO/SAML authentication
- RBAC (role-based access control)
- Audit Logs (compliance tracking)
- Self-hosted editions (Community/Team/Enterprise)
- License management
- Encrypted backups

## Getting Started

```bash
git clone https://github.com/minhduchd-mds/Design-md-ai.git
cd Design-md-ai
npm install
npm run dev        # Plugin + UI dev mode
npm run web:dev    # Web workspace
npm test           # Run 105+ tests
```

## How to Help

- **Good First Issues**: Look for the `good-first-issue` label
- **Documentation**: Improve guides, add examples
- **Testing**: Write tests for uncovered modules
- **Translations**: Help localize the UI
- **Bug Reports**: File detailed issues with reproduction steps

## Community

- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Questions and ideas
- Pull Requests: Code contributions

## License

MIT License. See [LICENSE](./LICENSE) for details.
