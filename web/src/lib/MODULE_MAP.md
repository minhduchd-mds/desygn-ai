# web/src/lib/ Module Organization

## Current Structure → Recommended Reorganization

Files are physically located in `web/src/lib/` for backward-compatible imports.
Barrel index files in each sub-folder re-export groups logically.

---

### engines/ — Core computation engines
- `shannonEngine.ts` — Multi-agent orchestrator (primary, v1)
- `shannonEngine10Agents.ts` — Extended 10-agent variant of ShannonEngine
- `evidenceMemory.ts` — HNSW vector search + sigmoid decay memory
- `evidenceMemoryIntegration.ts` — Integration layer for evidenceMemory
- `goapPlanner.ts` — Goal-Oriented Action Planning (A* search)
- `goapShannonBridge.ts` — Bridge connecting GOAP planner to Shannon engine
- `hnswVectorSearch.ts` — Low-level HNSW vector search primitives
- `designAnalyzer.ts` — WCAG scoring + design debt analysis
- `collaborationEngine.ts` — CRDT collaborative editing engine
- `aiPipeline.ts` — AI experiment pipeline orchestration
- `pipelineIntegration.ts` — Integration harness for aiPipeline
- `performanceOptimizations.ts` — Cross-cutting performance utilities

### stores/ — State management
- `agentMemory.ts` — Reactive workspace / agent memory state
- `queryStore.ts` — Query caching and reactive query state
- `requestCache.ts` — HTTP request-level caching

### clients/ — External service clients
- `apiClient.ts` — Base REST API client
- `streamClient.ts` — SSE/WebSocket streaming client
- `aiProviderClient.ts` — AI provider abstraction layer
- `providerRouter.ts` — Multi-provider routing + fallback logic
- `serverSync.ts` — Server synchronization (polling + push)
- `supabase.ts` — Supabase JS client singleton

### security/ — Security & validation
- `piiDetection.ts` — Vietnamese + general PII scanner
- `rateLimit.ts` — Client-side rate limiting

### infra/ — Infrastructure & cross-cutting concerns
- `eventBus.ts` — Event pub/sub system
- `errorBus.ts` — Centralized error handling bus
- `commandBus.ts` — Command pattern dispatcher
- `offlineQueue.ts` — Offline operation queue
- `enterpriseConfig.ts` — Enterprise feature flags & settings
- `selfHosted.ts` — Self-hosted deployment configuration
- `usageAnalytics.ts` — Usage telemetry (client-side)
- `useCommandShortcuts.ts` — React hook for keyboard command shortcuts

### integrations/ — External platform integrations
- `marketplace.ts` — Plugin marketplace client
- `gitSync.ts` — Git repository synchronization
- `frameworkAdapter.ts` — Framework adapters (React/Vue/etc.)
- `pluginSDK.ts` — Plugin SDK public API
- `designSystemHub.ts` — Design system hub connector
- `mobileSupport.ts` — Mobile support utilities

---

### Existing subdirectories (already organized)
- `di/` — Dependency injection container (`Container.ts`, `tokens.ts`, `bootstrap.ts`)
- `repos/` — Repository pattern for Supabase CRUD (`projectRepo.ts`, `auditRepo.ts`, `evidenceRepo.ts`, `githubRepo.ts`)
- `persistence.ts` — Legacy persistence facade (delegates to `repos/`)

### Test directory
- `__tests__/` — Vitest unit tests mirroring the flat lib structure

---

## File Count Summary
| Group       | Files |
|-------------|-------|
| engines/    | 12    |
| stores/     | 3     |
| clients/    | 6     |
| security/   | 2     |
| infra/      | 8     |
| integrations/| 6    |
| existing (di/, repos/, persistence.ts) | 7 |
| **Total root .ts** | **37** |

## Migration Notes
- Barrel `index.ts` files in each sub-folder re-export from `../` — no file moves needed.
- All existing `import … from '@/lib/<file>'` paths remain valid without change.
- To migrate incrementally: update imports one module at a time to use `@/lib/<group>`.
