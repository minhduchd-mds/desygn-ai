# 06 — Performance Engineering

> Mục tiêu: Desygn A11y phải nhanh ở mọi tầng. Audit 1000 nodes ≤ 30s, dashboard load ≤ 1.5s, list audits < 200ms. Performance là feature.

---

## 1. Performance budget

### Frontend budgets (mỗi route)

| Metric | Target | Hard cap | Tool |
|---|---|---|---|
| First Contentful Paint (FCP) | <1.0s | <1.8s | Lighthouse, PageSpeed |
| Largest Contentful Paint (LCP) | <1.5s | <2.5s | Lighthouse |
| Interaction to Next Paint (INP) | <100ms | <200ms | RUM via PostHog |
| Cumulative Layout Shift (CLS) | <0.05 | <0.1 | Lighthouse |
| Total Blocking Time (TBT) | <150ms | <300ms | Lighthouse |
| Speed Index | <2.0s | <3.0s | Lighthouse |
| JavaScript size (gzipped) | <180KB | <250KB | Vite analyzer |
| CSS size (gzipped) | <30KB | <50KB | Build report |
| Image weight per page | <300KB | <500KB | Lighthouse |

### Backend budgets

| Endpoint | P50 | P95 | P99 | Timeout |
|---|---|---|---|---|
| `POST /audit-start` | 200ms | 500ms | 1s | 5s |
| `GET /audit-status` | 50ms | 100ms | 200ms | 1s |
| `GET /audit-result` | 100ms | 300ms | 500ms | 2s |
| `GET /audits` (list, 50 items) | 150ms | 400ms | 800ms | 3s |
| `GET /report-pdf` | 800ms | 2s | 5s | 30s |
| `POST /billing/checkout` | 300ms | 800ms | 1.5s | 5s |
| Audit job (Inngest, 100 nodes) | 5s | 15s | 30s | 5min |
| Audit job (1000 nodes) | 20s | 60s | 120s | 5min |

### Database query budgets

| Query | P50 | P99 |
|---|---|---|
| User session lookup | 10ms | 50ms |
| Audit detail by ID | 20ms | 80ms |
| Audit list (50 rows) | 50ms | 200ms |
| Issue list (paginated) | 30ms | 150ms |
| Trend aggregation (30d) | 200ms | 500ms |

---

## 2. Audit performance — the hard problem

### Problem statement

Auditing a Figma file with 1000 nodes through 7 rules = up to 7,000 individual checks. Done naively → 30+ seconds. We need <10s.

### Strategy

#### 2.1 Parallelize rules
Each WCAG rule is independent. Run all 7 in parallel.

```ts
async function runAudit(nodes: SerializedNode[]) {
  const ruleResults = await Promise.all([
    contrastRule(nodes),
    touchTargetRule(nodes),
    ariaRule(nodes),
    keyboardRule(nodes),
    headingRule(nodes),
    motionRule(nodes),
    semanticRule(nodes),
  ]);
  return aggregate(ruleResults);
}
```

Speedup: ~6× because rules are I/O bound (some make external calls to Figma for screenshots).

#### 2.2 Batch Figma REST API calls

Figma REST API supports requesting multiple nodes in one call. Don't loop.

```ts
// BAD — 1000 requests
for (const node of nodes) {
  const data = await figma.getNode(node.id);
  // ...
}

// GOOD — 1 request
const allNodes = await figma.getFile(fileKey, { ids: nodes.map(n => n.id) });
```

For images (screenshots in PDF report):

```ts
// Get up to 100 node images per request
const chunks = chunk(nodeIds, 100);
const images = await Promise.all(chunks.map(c => figma.getImages(fileKey, c)));
```

#### 2.3 Cache aggressive

```ts
// In-memory LRU (per Inngest job)
const cache = new LRUCache<string, any>({ max: 1000, ttl: 1000 * 60 * 5 });

// Redis (cross-job, cross-instance)
async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSec = 300): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  const data = await fetcher();
  await redis.setex(key, ttlSec, data);
  return data;
}
```

Cache keys:
- Figma file content: `figma:${fileKey}:${version}` (5 min TTL)
- Figma file metadata: `figma:meta:${fileKey}` (1 hour TTL)
- Audit rules version: `audit:rules:v1` (24 hour TTL, invalidate on deploy)

#### 2.4 Avoid re-auditing unchanged content

```ts
// Compute checksum of normalized node tree
function computeChecksum(nodes: SerializedNode[]): string {
  const canonical = canonicalize(nodes); // sort keys, remove volatile fields
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// Check if same checksum already audited
const existing = await db.audit_runs
  .where("figma_file_key", fileKey)
  .where("checksum", checksum)
  .where("created_at", ">", "now() - 1 hour")
  .first();

if (existing) {
  return existing; // Return cached audit result
}
```

This is the biggest win — 60-80% of audits in production are duplicates (same file scanned by team multiple times daily).

#### 2.5 Stream results progressively

Don't wait for full audit. Send issues as found via SSE.

```ts
// Inngest function with progress events
export const auditRunner = inngest.createFunction(/* ... */, async ({ event, step }) => {
  const onProgress = async (rule: string, percent: number) => {
    await inngest.send({
      name: "audit/progress",
      data: { auditRunId: event.data.auditRunId, rule, percent },
    });
  };

  // Engine emits progress events
  const result = await engine.run(input, { onProgress });
});

// SSE endpoint subscribes to events
// User sees: "Checking contrast... 47%" instead of "Running..."
```

UX win: user perceives the operation as faster even if total time is same.

#### 2.6 Use Worker threads for CPU-heavy rules

Rules like contrast calculation are CPU-bound (color math). Run in worker threads.

```ts
// audit-worker.ts (Node.js Worker)
import { parentPort, workerData } from "worker_threads";
import { contrastRule } from "./rules/contrast";

const result = await contrastRule(workerData.nodes);
parentPort?.postMessage(result);
```

But: Vercel Edge doesn't support workers. Use Node.js runtime for audit-worker function only.

---

## 3. Database performance

### Indexes

Already added in migrations 005-008. Critical ones:

```sql
-- Most frequent: get audit list for user
create index idx_audit_runs_user_created on audit_runs(project_id, created_at desc);

-- Issue lookup
create index idx_audit_issues_run_severity on audit_issues(audit_run_id, severity);

-- Usage events (heavy writes)
create index idx_usage_events_user_month on usage_events(user_id, date_trunc('month', created_at));

-- Quota check (counts in current month)
create index idx_usage_count on usage_events(user_id, event_type, created_at)
  where created_at > now() - interval '30 days';
```

### Query optimization patterns

#### Pattern 1 — Avoid N+1

```ts
// BAD
const audits = await db.from("audit_runs").select("*");
for (const audit of audits) {
  audit.issues = await db.from("audit_issues").where({ audit_run_id: audit.id });
}

// GOOD — single query with join
const audits = await db.from("audit_runs").select(`
  *,
  audit_issues (
    id, severity, rule_id, message
  )
`);
```

#### Pattern 2 — Use materialized views for analytics

```sql
-- Refresh nightly
refresh materialized view a11y_trends;

-- Query is now fast (pre-computed)
select * from a11y_trends where project_id = $1 order by audit_date desc limit 30;
```

#### Pattern 3 — Cursor pagination, not OFFSET

```sql
-- BAD — slow for high offset
select * from audit_runs
order by created_at desc
limit 50 offset 10000;     -- Postgres scans 10,050 rows

-- GOOD — cursor pagination
select * from audit_runs
where (created_at, id) < ($cursor_time, $cursor_id)
order by created_at desc, id desc
limit 50;
```

#### Pattern 4 — Partial indexes for hot subsets

```sql
-- Only index active subscriptions (most queries filter status='active')
create index idx_active_subscriptions on subscriptions(user_id)
where status = 'active';
```

### Connection pooling

Use Supabase PgBouncer (already configured). Pool size:
- Transaction mode: 200 connections (Pro tier)
- Session mode: 30 connections (for migrations)

Vercel Edge connects via PgBouncer → no connection thrashing on cold starts.

---

## 4. Caching layers

### Layer 1 — Client (browser)

```ts
// TanStack Query stale-while-revalidate
const audit = useQuery({
  queryKey: ["audit", id],
  queryFn: () => api.audits.get(id),
  staleTime: 1000 * 60 * 5,         // Fresh for 5 min
  gcTime: 1000 * 60 * 30,           // Keep in cache 30 min
});
```

### Layer 2 — CDN (Vercel Edge Cache)

```ts
// API response headers
return new Response(JSON.stringify(data), {
  headers: {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    "CDN-Cache-Control": "max-age=3600",
  },
});
```

Edge cache 1 hour for immutable data (completed audit results).

### Layer 3 — Redis (Upstash)

Hot data, shared across instances:
- User session decoded JWT
- User tier + quota state
- Figma file content (during audit job)
- Rate limit counters

```ts
const tier = await redis.get(`user:${userId}:tier`);
if (!tier) {
  const fetched = await db.from("subscriptions").where({ user_id: userId }).single();
  await redis.setex(`user:${userId}:tier`, 300, fetched.tier);
  return fetched.tier;
}
return tier;
```

### Layer 4 — Database (Postgres)

- Last resort
- Query planner uses indexes
- Materialized views for aggregations

### Cache invalidation strategy

Most caches use **TTL** (time-to-live). Avoid manual invalidation complexity.

Exception: critical writes (subscription tier change) invalidate immediately:

```ts
await db.from("subscriptions").update({ tier: "pro" }).eq("user_id", userId);
await redis.del(`user:${userId}:tier`);
await redis.del(`user:${userId}:quota`);
```

---

## 5. Frontend rendering performance

### Code splitting

```ts
// Route-level — TanStack Router automatic
const Route = createFileRoute("/audits/$id/report")({ /* ... */ });

// Component-level — heavy features
const ReportPdfPreview = lazy(() => import("@/features/report/ReportPdfPreview"));

// Vendor splitting in Vite
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-popover", "framer-motion"],
          charts: ["recharts"],
        },
      },
    },
  },
});
```

### Virtualization for long lists

Audit detail có thể có 500+ issues. Don't render all DOM nodes.

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function IssueList({ issues }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <IssueRow issue={issues[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Memoization (with care)

```tsx
// Heavy component, props rarely change
const ExpensiveChart = memo(ChartComponent, (prev, next) => {
  return prev.data === next.data && prev.scale === next.scale;
});

// useMemo for expensive calculations
const grouped = useMemo(() => {
  return groupIssuesBySeverity(issues);
}, [issues]);

// useCallback for stable function refs (only when passed to memoized children)
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);
```

**Don't over-memoize.** React's reconciliation is fast. Profile before optimizing.

### Image optimization

```tsx
// Lazy load below-fold images
<img loading="lazy" src={...} alt="..." />

// Modern formats
<picture>
  <source srcSet="hero.avif" type="image/avif" />
  <source srcSet="hero.webp" type="image/webp" />
  <img src="hero.jpg" alt="..." />
</picture>

// Responsive sizes
<img
  srcSet="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
  sizes="(max-width: 768px) 100vw, 50vw"
  src="hero-800.jpg"
  alt="..."
/>
```

### Font loading

```html
<!-- Preload critical font -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

<!-- CSS -->
<style>
  @font-face {
    font-family: "Inter Variable";
    src: url("/fonts/inter-var.woff2") format("woff2-variations");
    font-weight: 100 900;
    font-display: swap;       /* Avoid FOIT */
  }
</style>
```

### Critical CSS

Vite handles automatically via `vite-plugin-critical`:

```ts
import critical from "vite-plugin-critical";

export default defineConfig({
  plugins: [
    critical({
      criticalUrl: "https://a11y.desygn.ai",
      criticalPages: [
        { uri: "/", template: "index" },
        { uri: "/dashboard", template: "app" },
      ],
    }),
  ],
});
```

---

## 6. Backend rendering performance

### PDF generation optimization

Generating PDF reports is the heaviest backend operation. Strategies:

#### Strategy 1 — Pre-render in background
When audit completes, immediately enqueue PDF generation. User downloads when ready.

```ts
// After audit save in Inngest function
await step.run("generate-pdf", async () => {
  await inngest.send({
    name: "report/generate-pdf",
    data: { auditRunId: audit.id, tier: user.tier },
  });
});
```

#### Strategy 2 — Stream PDF in chunks
For very large reports (500+ issues), stream rather than buffer.

```ts
import { renderToStream } from "@react-pdf/renderer";

const stream = await renderToStream(<Report audit={audit} />);

return new Response(stream as any, {
  headers: { "Content-Type": "application/pdf" },
});
```

#### Strategy 3 — Cache rendered PDFs
PDFs are immutable once generated. Cache forever.

```ts
const pdfUrl = await supabase.storage
  .from("reports")
  .createSignedUrl(`${auditRunId}.pdf`, 60 * 60 * 24 * 30); // 30 day signed URL
```

#### Strategy 4 — Use external PDF service for spikes
@react-pdf/renderer eats memory. For Pro+ tier with high volume, offload to:
- DocRaptor
- Browserless (Puppeteer cloud)
- Self-hosted Gotenberg

Decision rule: if PDF generation P95 > 5s for 2 weeks, offload.

### Edge function performance

Vercel Edge runs on Cloudflare Workers (or V8 isolates). Constraints:
- 50ms CPU time per request (free), 30s wall time
- No Node.js built-ins (use Web APIs)
- No native modules
- Cold start: 5-50ms (vs 500ms+ for Lambda)

Optimization:
- Use Web Crypto, not Node `crypto`
- Use `fetch`, not `axios`
- Use Web Streams, not Node streams
- Bundle minimally (no full lodash, only specific functions)

### Database connection management

```ts
// BAD — new connection per request, exhausts pool
import { createClient } from "@supabase/supabase-js";

export default async function handler(req) {
  const supabase = createClient(URL, KEY);
  // ...
}

// GOOD — module-level singleton (Vercel Edge keeps function warm)
const supabase = createClient(URL, KEY);

export default async function handler(req) {
  // Reuse supabase
}
```

---

## 7. Network optimization

### HTTP/2 multiplexing

Vercel + Cloudflare default. Enables parallel requests on single connection.

### Compression

```ts
// Vercel auto-applies Brotli for text responses
// Manual for API responses:
return new Response(json, {
  headers: { "Content-Encoding": "br" }, // Cloudflare adds automatically
});
```

### Reduce TLS negotiation

- Keep connections alive (default)
- Use HTTP/3 / QUIC where supported (Cloudflare flag)

### Prefetch critical resources

```tsx
// In root route
<head>
  <link rel="dns-prefetch" href="https://api.desygn.ai" />
  <link rel="preconnect" href="https://api.desygn.ai" crossOrigin="anonymous" />
  <link rel="preconnect" href="https://*.supabase.co" />
  <link rel="prefetch" href="/api/auth/session" />
</head>
```

---

## 8. Monitoring & alerting

### Real User Monitoring (RUM)

PostHog autocaptures Core Web Vitals:

```ts
// posthog.init in main.tsx
posthog.init(POSTHOG_KEY, {
  api_host: "https://app.posthog.com",
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  enable_recording_console_log: true,
});

// Custom Web Vitals
import { onCLS, onFID, onLCP, onINP } from "web-vitals";

onLCP((metric) => posthog.capture("web_vitals", { name: "LCP", value: metric.value }));
onINP((metric) => posthog.capture("web_vitals", { name: "INP", value: metric.value }));
// ...
```

### Server timing headers

```ts
const start = Date.now();
const dbStart = Date.now();
const data = await db.query(...);
const dbDuration = Date.now() - dbStart;

return new Response(JSON.stringify(data), {
  headers: {
    "Server-Timing": `db;dur=${dbDuration}, total;dur=${Date.now() - start}`,
  },
});
```

Visible in Chrome DevTools Network tab. Useful for debugging.

### Alerts (Sentry)

Trigger on:
- Error rate > 1% in 5 min
- LCP P95 > 3s for 10 min
- API P99 > 5s for 10 min
- Audit failure rate > 5%
- Database query P99 > 1s

### Dashboards

PostHog dashboards:
- "User funnel" — signup → first audit → upgrade
- "Audit performance" — duration distribution by node count
- "Feature usage" — which features each tier uses
- "Cohort retention" — Day 1, 7, 30 retention

---

## 9. Load testing

### Setup (before launch)

Use **k6** for synthetic load tests:

```js
// scripts/load-test-audit-start.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 10 },    // Ramp to 10 users
    { duration: "3m", target: 50 },    // Stay at 50
    { duration: "1m", target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.post(
    "https://api.desygn.ai/api/a11y/audit-start",
    JSON.stringify({ source: "figma", figma: { fileKey: "test", accessToken: TOKEN } }),
    { headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" } }
  );
  check(res, { "status 200": (r) => r.status === 200 });
}
```

### Target scenarios

1. **Spike test**: 0 → 200 users in 30s. Should not crash.
2. **Sustained**: 50 RPS for 30 min. Should hold P95.
3. **Soak test**: 20 RPS for 4 hours. Detect memory leaks.

### Before each major release

- Run load tests in staging
- Compare P95/P99 to previous release
- Block release if regression > 20%

---

## 10. Cost-performance tradeoffs

### Vercel costs

| Plan | Cost | Functions invocations | Bandwidth |
|---|---|---|---|
| Pro | $20/seat | 1M/mo | 1TB/mo |
| Pro + usage | $20 + $40/M invocations + $40/100GB | - | - |

At 1000 audits/day × 30 days = 30k audits/mo:
- Audit start: 30k × 4 endpoints = 120k function invocations
- Status polling: 30k × 30 polls = 900k invocations
- Result fetch: 30k = 30k invocations
- Total: ~1.1M/mo

**Vercel cost Year 1: ~$100/mo Pro + $50 overage = $150/mo**

### Supabase costs

- Pro: $25/mo + usage
- Database: 8GB included
- Storage: 100GB included
- Bandwidth: 250GB included

At 30k audits/mo × 50KB report = 1.5GB storage/mo. Fine.

**Supabase cost Year 1: $25/mo**

### Inngest costs

- Free: 50k function steps/mo
- Pro: $20/mo for 500k steps

At 30k audits × 6 steps = 180k steps/mo.

**Inngest cost Year 1: $20/mo Pro**

### Upstash Redis

- Free: 10k commands/day = 300k/mo
- Pay-as-you-go: $0.20 per 100k commands

Rate limiting + caching: ~500k commands/mo.

**Redis cost Year 1: $1/mo**

### Total infrastructure cost

| Month 1 | Month 6 | Month 12 |
|---|---|---|
| ~$50 (under free tiers) | ~$200 | ~$600 |

Revenue at Month 12 target: $130k MRR → infra cost is 0.5% of revenue. Healthy.

---

## 11. Performance regression prevention

### Lighthouse CI in GitHub Actions

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install && npm run build
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:3000/
            http://localhost:3000/pricing
            http://localhost:3000/dashboard
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

```json
// lighthouse-budget.json
[{
  "path": "/*",
  "timings": [
    { "metric": "first-contentful-paint", "budget": 1500 },
    { "metric": "largest-contentful-paint", "budget": 2500 },
    { "metric": "interactive", "budget": 3000 }
  ],
  "resourceSizes": [
    { "resourceType": "script", "budget": 250 },
    { "resourceType": "stylesheet", "budget": 50 },
    { "resourceType": "image", "budget": 300 }
  ]
}]
```

### Bundle size budget

```ts
// vite.config.ts
build: {
  reportCompressedSize: true,
  chunkSizeWarningLimit: 250, // KB
}
```

CI fails if any chunk > 250KB.

### Performance review gates

Every PR with >100 LOC change in `apps/a11y-dashboard/` requires:
- Lighthouse CI pass
- Bundle size diff < 10%
- E2E tests pass
- No new TypeScript `any`

---

## 12. Specific optimizations by feature

### Audit detail page

- LCP element: score gauge → render server-side, hydrate later
- Issue list: virtualized (>50 items)
- Issue images: lazy load when scrolled into view
- Side panel (issue detail): code-split

### Dashboard home

- KPI cards: parallel fetch via TanStack Query
- Recent audits: prefetch on hover
- Chart: use canvas (not SVG) for >100 data points

### Pricing page

- Pre-rendered at build time (SSG via TanStack Start)
- No JavaScript needed for initial view
- Stripe Pricing Table embedded only when clicked

### Audit start form

- Figma URL parser runs client-side (no API call needed)
- Wizard steps lazy-loaded
- Submit button optimistic UI

---

## 13. Long-term scalability

### Year 1 (1k DAU) — Current architecture suffices
- Vercel Edge + Supabase + Inngest + Upstash
- Single region (US East)

### Year 2 (10k DAU) — Add regions
- Supabase read replicas in EU + APAC
- Cloudflare R2 for storage (replace Supabase Storage)
- Honeycomb for distributed tracing
- Consider Postgres connection pooler upgrade

### Year 3 (100k DAU) — Microservices
- Extract audit-engine to its own service (Go for performance)
- Dedicated PDF generation cluster (Browserless)
- Event sourcing for audit results (immutable log)
- ClickHouse for analytics (replace materialized views)

---

## 14. Performance checklist for Claude Code

Before merging any PR:

- [ ] Lighthouse score ≥ 90 on all 4 metrics
- [ ] Bundle size diff < 5% (or justified)
- [ ] No new `useEffect` without dependencies array
- [ ] No new sync calls in async path (no `JSON.parse` of large string in render)
- [ ] No new uncached DB queries on hot path
- [ ] Images use `loading="lazy"` if below fold
- [ ] Fonts: `font-display: swap`
- [ ] No new prod console.log statements
- [ ] Critical path: no third-party scripts blocking render
- [ ] Server response: `Cache-Control` header set appropriately
- [ ] DB queries: explained via `EXPLAIN ANALYZE` if new query type
- [ ] Audit job: no rule takes > 5s for typical input
