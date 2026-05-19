# Add Benchmark for Design Parser

**Labels:** `good-first-issue`, `testing`, `performance`

## Context
The `benchmarks/` directory has 4 benchmarks (HNSW, Evidence Memory, PII, GOAP) but the design parser — one of the most-used modules — has no performance benchmark yet.

## Requirements
- Create `benchmarks/design-parser.bench.ts`
- Benchmark `buildDesignMd()` with varying input sizes (10, 50, 200 components)
- Benchmark `buildPreviewText()` with all presets
- Generate mock Figma node data at each size
- Register in `benchmarks/index.ts`

## Reference
Look at existing benchmarks for the pattern:
- `benchmarks/hnsw.bench.ts` — vector search benchmark
- `benchmarks/bench.ts` — shared runner utility

## Files to create/modify
- `benchmarks/design-parser.bench.ts` — New file
- `benchmarks/index.ts` — Add import

## Acceptance criteria
- [ ] Benchmark runs via `npx tsx benchmarks/index.ts`
- [ ] Reports ops/sec and p95 latency for each input size
- [ ] No Figma API calls (use mock data)
- [ ] Results printed in table format matching existing benchmarks
