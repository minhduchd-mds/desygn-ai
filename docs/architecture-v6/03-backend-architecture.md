# 03 — Backend Architecture

## 1. High-level system diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │                  CUSTOMER SURFACES                    │
                    ├─────────────────────────────────────────────────────┤
                    │  Figma Plugin  │  Web Dashboard  │  IDE Extension     │
                    │  (existing)    │  (NEW v1)       │  (NEW v2)         │
                    │                │                 │                    │
                    │  GitHub Action │  MCP Server     │  REST API          │
                    │  (NEW v1)      │  (NEW v1)       │  (NEW v1)         │
                    └────────┬───────┴────────┬────────┴────────┬──────────┘
                             │                │                  │
                             ▼                ▼                  ▼
                    ┌─────────────────────────────────────────────────────┐
                    │              API GATEWAY (Vercel Edge)                │
                    │  • Auth (JWT verify)                                  │
                    │  • Rate limit (Upstash Redis)                         │
                    │  • CORS, CSP, security headers                        │
                    │  • Request logging (PostHog + Sentry)                 │
                    └────────┬────────────────────────────────────────────┘
                             │
                ┌────────────┼────────────┬─────────────────┐
                │            │            │                 │
                ▼            ▼            ▼                 ▼
        ┌──────────┐  ┌─────────┐  ┌──────────┐    ┌──────────────┐
        │  /audit   │  │ /report │  │  /team   │    │  /webhook    │
        │  routes   │  │  routes │  │  routes  │    │  routes      │
        └─────┬────┘  └────┬────┘  └────┬─────┘    └──────┬───────┘
              │            │            │                  │
              ▼            ▼            ▼                  ▼
        ┌─────────────────────────────────────────────────────┐
        │              CORE SERVICES (TypeScript)              │
        │  • AuditEngine (wraps AccessibilityAgent)           │
        │  • ReportGenerator (PDF/SARIF/CSV/MD)               │
        │  • FigmaAdapter (REST API client)                   │
        │  • UsageTracker (quota enforcement)                 │
        │  • BillingService (Stripe wrapper)                  │
        └────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┬─────────────────┬─────────────┐
        ▼                 ▼                 ▼              ▼
  ┌──────────┐    ┌─────────────┐    ┌──────────┐  ┌──────────┐
  │ Supabase │    │  Upstash    │    │  Inngest │  │  Stripe  │
  │ (Postgres│    │   Redis     │    │  (Queue) │  │  (Billing│
  │  + Auth  │    │  (Cache +   │    │          │  │   + Tax) │
  │  + RLS)  │    │  RateLimit) │    │          │  │          │
  └──────────┘    └─────────────┘    └──────────┘  └──────────┘
        │
        ▼
  ┌──────────┐
  │ Supabase │
  │ Storage  │
  │ (Reports │
  │  CDN)    │
  └──────────┘
```

---

## 2. Folder structure mới (extend repo hiện tại)

```
Design-md-ai-main/
├── api/                              # Existing — Vercel Edge functions
│   ├── chat.ts                       # Existing
│   ├── analyze-image.ts              # Existing
│   ├── a11y/                         # NEW
│   │   ├── audit-start.ts            # POST /api/a11y/audit-start
│   │   ├── audit-status.ts           # GET /api/a11y/audit-status?id=
│   │   ├── audit-result.ts           # GET /api/a11y/audit-result?id=
│   │   ├── audit-list.ts             # GET /api/a11y/audits?cursor=
│   │   ├── report-pdf.ts             # GET /api/a11y/report-pdf?id=
│   │   ├── report-sarif.ts           # GET /api/a11y/report-sarif?id=
│   │   ├── audit-stream.ts           # GET /api/a11y/audit-stream?id= (SSE)
│   │   └── webhook.ts                # POST /api/a11y/webhook (GitHub)
│   ├── billing/                      # NEW
│   │   ├── checkout.ts               # POST /api/billing/checkout
│   │   ├── portal.ts                 # POST /api/billing/portal
│   │   └── webhook.ts                # POST /api/billing/webhook (Stripe)
│   ├── team/                         # NEW
│   │   ├── invite.ts                 # POST /api/team/invite
│   │   ├── members.ts                # GET /api/team/members
│   │   ├── remove.ts                 # DELETE /api/team/remove
│   │   └── role.ts                   # PATCH /api/team/role
│   └── lib/
│       ├── rateLimit.ts              # REWRITE — Upstash Redis
│       ├── auth.ts                   # NEW — JWT verification + Supabase
│       ├── quota.ts                  # NEW — Tier-based quota checks
│       └── audit-shared.ts           # NEW
├── packages/                         # NEW workspace (pnpm)
│   ├── audit-engine/                 # NEW
│   │   ├── src/
│   │   │   ├── index.ts              # AuditEngine class
│   │   │   ├── rules/
│   │   │   │   ├── contrast.ts       # WCAG 1.4.3, 1.4.6
│   │   │   │   ├── touch-target.ts   # WCAG 2.5.5, 2.5.8
│   │   │   │   ├── aria.ts           # WCAG 1.3.1, 4.1.2
│   │   │   │   ├── keyboard.ts       # WCAG 2.1.1, 2.4.7
│   │   │   │   ├── heading.ts        # WCAG 1.3.1
│   │   │   │   └── motion.ts         # WCAG 2.3.3
│   │   │   ├── scoring.ts            # Aggregate score 0-100
│   │   │   └── types.ts              # AuditInput, AuditResult
│   │   └── package.json
│   ├── report-generator/             # NEW
│   │   ├── src/
│   │   │   ├── pdf.ts                # PDF render với @react-pdf/renderer
│   │   │   ├── sarif.ts              # SARIF v2.1.0 format
│   │   │   ├── csv.ts                # CSV export
│   │   │   ├── markdown.ts           # MD format
│   │   │   ├── signer.ts             # PDF signature (HMAC-SHA256)
│   │   │   └── templates/            # PDF templates
│   │   └── package.json
│   ├── figma-rest-adapter/           # NEW
│   │   ├── src/
│   │   │   ├── client.ts             # Figma REST API client
│   │   │   ├── transformer.ts        # REST response → SerializedNode
│   │   │   └── cache.ts              # In-memory cache
│   │   └── package.json
│   └── mcp-server/                   # NEW (Move 1 + future)
│       ├── src/
│       │   ├── index.ts              # @modelcontextprotocol/sdk
│       │   ├── tools/
│       │   │   ├── audit-figma.ts    # Tool: audit_figma_for_a11y
│       │   │   └── get-report.ts     # Tool: get_audit_report
│       │   └── transports/
│       └── package.json
├── supabase/
│   ├── migrations/
│   │   ├── 001_project_versions.sql        # Existing
│   │   ├── 002_audit_evidence.sql          # Existing
│   │   ├── 003_user_profiles_rbac.sql      # Existing
│   │   ├── 004_agent_runs.sql              # Existing
│   │   ├── 005_billing_subscriptions.sql   # NEW
│   │   ├── 006_a11y_audit_extensions.sql   # NEW
│   │   ├── 007_audit_queue.sql             # NEW
│   │   └── 008_api_keys.sql                # NEW
│   └── functions/                          # NEW — Edge Functions
│       └── audit-worker/                   # Long-running audit job
│           └── index.ts
├── inngest/                          # NEW
│   ├── client.ts                     # Inngest client setup
│   └── functions/
│       ├── audit-runner.ts           # Audit job handler
│       ├── usage-rollup.ts           # Daily aggregation
│       └── churn-detector.ts         # Detect inactive users
└── ... (existing)
```

---

## 3. Database schema mới

### Migration 005 — Billing subscriptions

```sql
-- 005_billing_subscriptions.sql
-- Stripe subscription state + usage tracking

create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  team_id               uuid references public.teams(id) on delete cascade,
  stripe_customer_id    text unique not null,
  stripe_subscription_id text unique not null,
  tier                  text not null check (tier in ('free', 'pro', 'team', 'enterprise')),
  status                text not null check (status in ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  current_period_start  timestamptz not null,
  current_period_end    timestamptz not null,
  cancel_at_period_end  boolean default false,
  metadata              jsonb default '{}'::jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index idx_subscriptions_user on subscriptions(user_id);
create index idx_subscriptions_team on subscriptions(team_id);
create index idx_subscriptions_stripe on subscriptions(stripe_subscription_id);

create table if not exists public.teams (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique not null,
  owner_id            uuid references auth.users(id) on delete restrict not null,
  seat_count          int not null default 5,
  custom_branding     jsonb,                              -- logo, colors
  custom_wcag_rules   jsonb,                              -- custom rule overrides
  sso_enabled         boolean default false,
  sso_config          jsonb,                              -- SAML/OIDC config (encrypted)
  data_residency      text default 'us' check (data_residency in ('us', 'eu', 'apac')),
  created_at          timestamptz default now()
);

create index idx_teams_owner on teams(owner_id);
create index idx_teams_slug on teams(slug);

create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references public.teams(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  role        text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by  uuid references auth.users(id),
  invited_at  timestamptz default now(),
  joined_at   timestamptz,
  unique (team_id, user_id)
);

create index idx_team_members_team on team_members(team_id);
create index idx_team_members_user on team_members(user_id);

create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  team_id       uuid references public.teams(id) on delete cascade,
  event_type    text not null,                            -- 'audit', 'pdf_export', 'api_call'
  quantity      int not null default 1,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

-- Partitioned by month for query performance
create index idx_usage_events_user_time on usage_events(user_id, created_at desc);
create index idx_usage_events_team_time on usage_events(team_id, created_at desc);
create index idx_usage_events_type_time on usage_events(event_type, created_at desc);

-- RLS
alter table subscriptions enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table usage_events enable row level security;

create policy "Users see own subscriptions"
  on subscriptions for select using (user_id = auth.uid());

create policy "Team members see team subscription"
  on subscriptions for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Team members see team"
  on teams for select using (
    id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Team admins manage members"
  on team_members for all using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Users see own usage"
  on usage_events for select using (user_id = auth.uid());
```

### Migration 006 — A11y audit extensions

```sql
-- 006_a11y_audit_extensions.sql
-- Extends existing audit_runs (migration 002) for A11y-specific fields

alter table public.audit_runs
  add column if not exists wcag_version text default '2.2' check (wcag_version in ('2.0', '2.1', '2.2', '3.0')),
  add column if not exists wcag_level text default 'AA' check (wcag_level in ('A', 'AA', 'AAA')),
  add column if not exists figma_file_key text,
  add column if not exists figma_node_id text,
  add column if not exists frame_count int,
  add column if not exists node_count int,
  add column if not exists audit_duration_ms int,
  add column if not exists report_signature text,             -- HMAC for tamper-proof
  add column if not exists pdf_url text,                      -- Supabase Storage URL
  add column if not exists sarif_url text;

create index if not exists idx_audit_runs_user_time on audit_runs(project_id, created_at desc);
create index if not exists idx_audit_runs_figma on audit_runs(figma_file_key);

-- A11y rule registry (configurable per team)
create table if not exists public.a11y_rules (
  id              text primary key,                          -- e.g. "contrast.normal-text"
  wcag_criterion  text not null,                             -- e.g. "1.4.3"
  wcag_level      text not null,
  category        text not null,                             -- contrast/keyboard/aria/...
  severity        text not null default 'medium',
  enabled         boolean default true,
  configuration   jsonb default '{}'::jsonb,
  description     text not null,
  created_at      timestamptz default now()
);

create table if not exists public.team_rule_overrides (
  team_id     uuid references public.teams(id) on delete cascade not null,
  rule_id     text references public.a11y_rules(id) on delete cascade not null,
  enabled     boolean,
  configuration jsonb,
  primary key (team_id, rule_id)
);

-- Issue tracking for trend analysis
create table if not exists public.audit_issues (
  id              uuid primary key default gen_random_uuid(),
  audit_run_id    uuid references public.audit_runs(id) on delete cascade not null,
  rule_id         text references public.a11y_rules(id) not null,
  severity        text not null check (severity in ('critical', 'serious', 'moderate', 'minor')),
  node_id         text not null,
  node_name       text,
  node_type       text,
  page_name       text,
  message         text not null,
  expected        text,
  observed        text,
  fix_suggestion  jsonb,
  wcag_criterion  text,
  status          text not null default 'open' check (status in ('open', 'fixed', 'wont-fix', 'false-positive')),
  fixed_in_audit_id uuid references audit_runs(id),
  created_at      timestamptz default now()
);

create index idx_audit_issues_run on audit_issues(audit_run_id);
create index idx_audit_issues_rule on audit_issues(rule_id);
create index idx_audit_issues_severity on audit_issues(severity);
create index idx_audit_issues_status on audit_issues(status);

-- Trends materialized view (refreshed nightly)
create materialized view if not exists a11y_trends as
select
  project_id,
  date_trunc('day', created_at)::date as audit_date,
  count(*) as audit_count,
  avg(overall_score) as avg_score,
  sum(case when severity = 'critical' then 1 else 0 end) as critical_count,
  sum(case when severity = 'serious' then 1 else 0 end) as serious_count
from audit_runs ar
left join audit_issues ai on ai.audit_run_id = ar.id
where status = 'completed'
group by project_id, date_trunc('day', created_at)::date;

create unique index idx_a11y_trends on a11y_trends(project_id, audit_date);
```

### Migration 007 — Audit queue

```sql
-- 007_audit_queue.sql
-- Async audit job queue (backup to Inngest)

create table if not exists public.audit_queue (
  id              uuid primary key default gen_random_uuid(),
  audit_run_id    uuid references public.audit_runs(id) on delete cascade not null,
  user_id         uuid references auth.users(id) not null,
  priority        int not null default 5 check (priority between 0 and 10),
  status          text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'retrying')),
  attempts        int not null default 0,
  max_attempts    int not null default 3,
  payload         jsonb not null,
  error           text,
  scheduled_for   timestamptz default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);

create index idx_queue_pending on audit_queue(status, scheduled_for) where status in ('pending', 'retrying');
create index idx_queue_user on audit_queue(user_id, created_at desc);
```

### Migration 008 — API keys

```sql
-- 008_api_keys.sql

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  team_id       uuid references public.teams(id) on delete cascade,
  name          text not null,
  key_hash      text unique not null,                       -- SHA-256 of key
  key_prefix    text not null,                              -- First 8 chars for display (sk_live_abc...)
  scopes        text[] not null default '{audit:read,audit:write}',
  last_used_at  timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz default now()
);

create index idx_api_keys_hash on api_keys(key_hash) where revoked_at is null;
create index idx_api_keys_user on api_keys(user_id);
create index idx_api_keys_team on api_keys(team_id);

alter table api_keys enable row level security;

create policy "Users manage own keys"
  on api_keys for all using (user_id = auth.uid());

create policy "Team admins manage team keys"
  on api_keys for all using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
```

---

## 4. API endpoints (REST + SSE)

### Audit endpoints

**POST `/api/a11y/audit-start`**
- Auth: Bearer token (Supabase JWT) hoặc API key
- Body:
  ```ts
  {
    source: "figma" | "design-md" | "uploaded-json",
    figma?: { fileKey: string; nodeId?: string; accessToken: string },
    designMd?: { content: string },
    options?: {
      wcagVersion?: "2.0" | "2.1" | "2.2";
      wcagLevel?: "A" | "AA" | "AAA";
      rules?: string[];                // override default rule set
      includeAiSuggestions?: boolean;
    }
  }
  ```
- Response: `{ auditRunId: string; queueId: string; estimatedDurationMs: number }`
- Status codes: 200, 401, 402 (quota exceeded), 429 (rate limit)

**GET `/api/a11y/audit-status?id=`**
- Returns: `{ status: "queued" | "running" | "completed" | "failed"; progress: 0-100 }`
- Headers: `Cache-Control: no-store` (real-time)

**GET `/api/a11y/audit-stream?id=` (SSE)**
- Live progress updates: `data: {"event":"progress","progress":47,"currentStep":"contrast"}`
- Final: `data: {"event":"complete","auditRunId":"..."}`
- Implements existing `web/src/ux-checklist/stream.ts` pattern

**GET `/api/a11y/audit-result?id=`**
- Returns full `AuditResult` JSON
- Cached 1 hour (immutable result)
- Headers: `ETag`, `Cache-Control: public, max-age=3600, immutable`

**GET `/api/a11y/audits?cursor=&limit=&projectId=`**
- Paginated list of user's audits
- Cursor-based pagination using `created_at + id`

**GET `/api/a11y/report-pdf?id=`**
- Returns signed PDF blob
- Header: `Content-Type: application/pdf`
- Pro+ only (403 cho free)

**GET `/api/a11y/report-sarif?id=`**
- SARIF v2.1.0 JSON for GitHub Code Scanning
- Used by GitHub Action

### Webhook endpoints

**POST `/api/a11y/webhook`** (GitHub Action)
- Body: GitHub PR event payload
- Auth: webhook secret HMAC
- Triggers audit if PR description has Figma link

**POST `/api/billing/webhook`** (Stripe)
- Handle: `customer.subscription.*`, `invoice.payment_*`
- Auth: Stripe signature verification
- Updates `subscriptions` table

### Billing endpoints

**POST `/api/billing/checkout`**
- Body: `{ tier: "pro" | "team"; seats?: number; period: "monthly" | "yearly" }`
- Creates Stripe Checkout session
- Returns: `{ url: string }`

**POST `/api/billing/portal`**
- Creates Stripe Customer Portal session
- For users to manage subscription/payment method

---

## 5. Core services

### AuditEngine (`packages/audit-engine/src/index.ts`)

```ts
import { contrastRule } from "./rules/contrast";
import { touchTargetRule } from "./rules/touch-target";
// ... other rules

export class AuditEngine {
  constructor(
    private readonly config: AuditConfig,
    private readonly logger: Logger,
  ) {}

  async run(input: AuditInput): Promise<AuditResult> {
    const startTime = Date.now();
    const rules = this.selectRules(input.options);
    const issues: AuditIssue[] = [];

    // Run all rules in parallel
    const results = await Promise.all(
      rules.map(rule => this.runRule(rule, input))
    );

    for (const result of results) {
      issues.push(...result.issues);
    }

    const score = this.calculateScore(issues, input.nodes.length);
    const summary = this.summarize(issues);

    return {
      id: crypto.randomUUID(),
      score,
      issues,
      summary,
      durationMs: Date.now() - startTime,
      wcagVersion: input.options.wcagVersion ?? "2.2",
      wcagLevel: input.options.wcagLevel ?? "AA",
    };
  }

  private async runRule(rule: A11yRule, input: AuditInput) {
    try {
      return await rule.evaluate(input);
    } catch (err) {
      this.logger.error("rule failed", { ruleId: rule.id, err });
      return { issues: [] };
    }
  }

  private calculateScore(issues: AuditIssue[], totalNodes: number): number {
    // Score 100 - weighted deductions per severity
    const weights = { critical: 10, serious: 5, moderate: 2, minor: 0.5 };
    const deduction = issues.reduce((sum, i) => sum + weights[i.severity], 0);
    return Math.max(0, Math.round(100 - deduction));
  }
}
```

### ReportGenerator (`packages/report-generator/src/pdf.ts`)

```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { signReport } from "./signer";

export async function generatePdfReport(audit: AuditResult, branding?: Branding): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <ReportTemplate audit={audit} branding={branding} />
  );

  // Sign with HMAC for tamper-proof verification
  const signature = await signReport(buffer);
  const signed = await appendSignatureMetadata(buffer, signature);

  return signed;
}
```

### FigmaAdapter (`packages/figma-rest-adapter/src/client.ts`)

```ts
export class FigmaRestClient {
  constructor(
    private readonly token: string,
    private readonly cache: Cache,
  ) {}

  async getFile(fileKey: string, nodeIds?: string[]): Promise<FigmaFileResponse> {
    const cacheKey = `figma:${fileKey}:${nodeIds?.join(",") ?? "all"}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    if (nodeIds?.length) {
      url.searchParams.set("ids", nodeIds.join(","));
    }
    url.searchParams.set("depth", "100");
    url.searchParams.set("geometry", "paths");

    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.token },
    });

    if (!res.ok) throw new FigmaApiError(res.status, await res.text());

    const data = await res.json();
    await this.cache.set(cacheKey, data, 300); // 5 min cache
    return data;
  }

  async getImages(fileKey: string, nodeIds: string[]): Promise<Record<string, string>> {
    // For PDF report screenshots
    const url = new URL(`https://api.figma.com/v1/images/${fileKey}`);
    url.searchParams.set("ids", nodeIds.join(","));
    url.searchParams.set("format", "png");
    url.searchParams.set("scale", "2");

    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.token },
    });

    const data = await res.json();
    return data.images;
  }
}
```

### UsageTracker (`api/lib/quota.ts`)

```ts
import { Redis } from "@upstash/redis";
import { supabase } from "./supabase-admin";

const TIER_QUOTAS = {
  free: { auditsPerMonth: 5, apiCallsPerHour: 0, rateLimitPerMin: 5 },
  pro: { auditsPerMonth: 100, apiCallsPerHour: 100, rateLimitPerMin: 60 },
  team: { auditsPerMonth: 1000, apiCallsPerHour: 1000, rateLimitPerMin: 600 },
  enterprise: { auditsPerMonth: Infinity, apiCallsPerHour: Infinity, rateLimitPerMin: 6000 },
};

export async function checkQuota(
  userId: string,
  resource: "audit" | "api",
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const tier = await getUserTier(userId);
  const quota = TIER_QUOTAS[tier];

  if (resource === "audit") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "audit")
      .gte("created_at", monthStart.toISOString());

    const remaining = quota.auditsPerMonth - (count ?? 0);
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      resetAt: nextMonthStart(),
    };
  }

  // API quota — sliding window with Redis
  const redis = Redis.fromEnv();
  const key = `quota:${userId}:api:${currentHourBucket()}`;
  const used = await redis.incr(key);
  await redis.expire(key, 3600);

  return {
    allowed: used <= quota.apiCallsPerHour,
    remaining: Math.max(0, quota.apiCallsPerHour - used),
    resetAt: nextHourStart(),
  };
}
```

---

## 6. Queue architecture với Inngest

### Tại sao Inngest?

- Vercel function timeout 30s không đủ cho audit lớn (1000+ nodes)
- Inngest cho phép step-based execution với retries
- Built-in observability (Inngest Dev UI)
- Free tier đủ cho năm 1 (50k steps/tháng)

### Audit job

```ts
// inngest/functions/audit-runner.ts
import { inngest } from "../client";

export const auditRunner = inngest.createFunction(
  {
    id: "audit-runner",
    concurrency: { limit: 10, key: "event.data.userId" },
    retries: 3,
  },
  { event: "audit/start" },
  async ({ event, step }) => {
    const { auditRunId, source, payload } = event.data;

    // Step 1: Fetch Figma data
    const figmaData = await step.run("fetch-figma", async () => {
      if (source === "figma") {
        const client = new FigmaRestClient(payload.accessToken, cache);
        return await client.getFile(payload.fileKey, payload.nodeIds);
      }
      return null;
    });

    // Step 2: Transform to SerializedNode
    const nodes = await step.run("transform", async () => {
      return transformFigmaToNodes(figmaData);
    });

    // Step 3: Run audit
    const result = await step.run("audit", async () => {
      const engine = new AuditEngine(config, logger);
      return await engine.run({ nodes, options: payload.options });
    });

    // Step 4: Save results
    await step.run("save", async () => {
      await supabase.from("audit_runs").update({
        status: "completed",
        overall_score: result.score,
        audit_duration_ms: result.durationMs,
      }).eq("id", auditRunId);

      await supabase.from("audit_issues").insert(
        result.issues.map(i => ({ audit_run_id: auditRunId, ...i }))
      );
    });

    // Step 5: Generate PDF (Pro+ only)
    if (payload.tier !== "free") {
      const pdfUrl = await step.run("generate-pdf", async () => {
        const pdf = await generatePdfReport(result, payload.branding);
        return await uploadToStorage(`reports/${auditRunId}.pdf`, pdf);
      });

      await supabase.from("audit_runs").update({ pdf_url: pdfUrl }).eq("id", auditRunId);
    }

    // Step 6: Send notifications
    await step.run("notify", async () => {
      await sendEmailNotification(event.data.userId, auditRunId);
      // Webhook callback if configured
    });

    return { auditRunId, score: result.score };
  }
);
```

---

## 7. Authentication & authorization

### Authentication flow

**Supabase Auth làm primary IdP:**

1. **Email + password** (default)
2. **Google OAuth** (added)
3. **GitHub OAuth** (added)
4. **SSO SAML** (Team+ tier, via Supabase enterprise)
5. **API key** (header `Authorization: Bearer dak_live_...`)

### JWT verification (`api/lib/auth.ts`)

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const SUPABASE_JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/keys`)
);

export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new AuthError("Missing authorization header");

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") throw new AuthError("Invalid scheme");

  // Try Supabase JWT first
  if (token.startsWith("eyJ")) {
    const { payload } = await jwtVerify(token, SUPABASE_JWKS, {
      audience: "authenticated",
    });
    return { type: "user", userId: payload.sub!, tier: payload.app_metadata?.tier ?? "free" };
  }

  // Otherwise API key
  if (token.startsWith("dak_live_") || token.startsWith("dak_test_")) {
    const hash = await sha256(token);
    const { data } = await supabase
      .from("api_keys")
      .select("*, user:users(*)")
      .eq("key_hash", hash)
      .is("revoked_at", null)
      .single();

    if (!data) throw new AuthError("Invalid API key");
    return { type: "api_key", keyId: data.id, userId: data.user_id, tier: await getUserTier(data.user_id) };
  }

  throw new AuthError("Invalid token");
}
```

### Authorization (RBAC)

Reuse `shared/permissions/permissions.ts` (đã có 22 scopes, 9 roles).

```ts
import { hasPermission } from "@/shared/permissions";

// In endpoint:
const ctx = await authenticate(req);
if (!hasPermission(ctx.role, "audit:write")) {
  return new Response("Forbidden", { status: 403 });
}
```

---

## 8. Stripe integration

### Setup

1. Create Stripe products:
   - `prod_a11y_pro_monthly` — $29/mo
   - `prod_a11y_pro_yearly` — $290/yr
   - `prod_a11y_team_base` — $299/mo (5 seats)
   - `prod_a11y_team_seat` — $59/seat/mo
   - `prod_a11y_compliance_bundle` — $1500 one-time

2. Webhook endpoint: `/api/billing/webhook`
   - Listen: `customer.subscription.created/updated/deleted`, `invoice.paid/payment_failed`
   - Update `subscriptions` table accordingly

### Checkout flow

```ts
// api/billing/checkout.ts
export default async function handler(req: Request) {
  const { tier, period, seats } = await req.json();
  const ctx = await authenticate(req);

  const session = await stripe.checkout.sessions.create({
    customer_email: ctx.email,
    mode: "subscription",
    line_items: buildLineItems(tier, period, seats),
    success_url: `${BASE_URL}/dashboard/billing?success=true`,
    cancel_url: `${BASE_URL}/pricing`,
    metadata: { userId: ctx.userId, tier, period },
    automatic_tax: { enabled: true },         // Stripe Tax for VAT
    customer_update: { name: "auto", address: "auto" },
    consent_collection: { terms_of_service: "required" },
  });

  return Response.json({ url: session.url });
}
```

### Failed payment handling

```ts
// Stripe dunning: retry 3x, then cancel
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  await supabase.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", invoice.subscription);

  // Send email
  await resend.emails.send({
    to: invoice.customer_email,
    subject: "Payment failed — action required",
    react: PaymentFailedEmail({ invoiceUrl: invoice.hosted_invoice_url }),
  });

  // After 3rd failure, downgrade to free
  if (invoice.attempt_count >= 3) {
    await downgradeToFree(invoice.customer);
  }
}
```

---

## 9. PDF report signing

### Why sign?
Compliance auditors need verifiable reports. A signed PDF proves:
1. Generated by Desygn A11y at specific timestamp
2. Not tampered with after generation

### Signing implementation

```ts
// packages/report-generator/src/signer.ts
import { createHmac } from "crypto";

const SECRET = process.env.REPORT_SIGNING_SECRET!; // 32-byte secret

export function signReport(pdf: Buffer, metadata: ReportMetadata): SignedReport {
  // Hash content + metadata
  const hmac = createHmac("sha256", SECRET);
  hmac.update(pdf);
  hmac.update(JSON.stringify(metadata));
  const signature = hmac.digest("hex");

  return {
    pdf,
    signature,
    metadata: {
      ...metadata,
      signedAt: new Date().toISOString(),
      signedBy: "Desygn A11y v1.0.0",
      verificationUrl: `https://a11y.desygn.ai/verify?sig=${signature}`,
    },
  };
}

export function verifyReport(pdf: Buffer, signature: string, metadata: ReportMetadata): boolean {
  const expected = signReport(pdf, metadata).signature;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Verification page

Public page `a11y.desygn.ai/verify?sig=...`:
- Upload PDF
- Server re-extracts content + metadata
- Re-signs and compares
- Shows: ✅ "Valid — generated by Desygn A11y on [date]" hoặc ❌ "Invalid signature"

---

## 10. MCP server tools

### Tool: `audit_figma_for_a11y`

```ts
// packages/mcp-server/src/tools/audit-figma.ts
import { Tool } from "@modelcontextprotocol/sdk/server";
import { z } from "zod";

const inputSchema = z.object({
  figmaUrl: z.string().url(),
  figmaAccessToken: z.string(),
  wcagVersion: z.enum(["2.0", "2.1", "2.2"]).default("2.2"),
  wcagLevel: z.enum(["A", "AA", "AAA"]).default("AA"),
});

export const auditFigmaTool: Tool = {
  name: "audit_figma_for_a11y",
  description: "Audit a Figma file or frame for WCAG accessibility violations. Returns structured issues with fix suggestions.",
  inputSchema,
  async handler(input) {
    const parsed = inputSchema.parse(input);
    const { fileKey, nodeId } = parseFigmaUrl(parsed.figmaUrl);

    // Call internal API
    const res = await fetch(`${API_URL}/api/a11y/audit-start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DESYGN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "figma",
        figma: { fileKey, nodeId, accessToken: parsed.figmaAccessToken },
        options: { wcagVersion: parsed.wcagVersion, wcagLevel: parsed.wcagLevel },
      }),
    });

    const { auditRunId } = await res.json();

    // Poll for completion (with timeout)
    const result = await pollUntilComplete(auditRunId, { timeout: 120000 });

    return {
      content: [{
        type: "text",
        text: formatAuditResultForLLM(result),
      }],
    };
  },
};

function formatAuditResultForLLM(audit: AuditResult): string {
  return [
    `# Accessibility Audit Results`,
    `Score: ${audit.score}/100 (WCAG ${audit.wcagVersion} ${audit.wcagLevel})`,
    ``,
    `## Summary`,
    `- Critical: ${audit.summary.critical}`,
    `- Serious: ${audit.summary.serious}`,
    `- Moderate: ${audit.summary.moderate}`,
    `- Minor: ${audit.summary.minor}`,
    ``,
    `## Top Issues`,
    ...audit.issues.slice(0, 10).map(i => formatIssue(i)),
  ].join("\n");
}
```

---

## 11. Observability

### Logging
- Structured logs via Pino → Vercel Log Drain → Axiom
- Log levels: `debug` (dev only), `info`, `warn`, `error`
- PII redaction enforced (`shared/lib/piiDetection.ts`)

### Metrics
- PostHog for product analytics (audit started, completed, failed)
- Stripe Sigma for revenue metrics
- Supabase metrics for DB performance

### Errors
- Sentry for unhandled exceptions
- Source maps uploaded on every deploy
- Alert: error rate > 1% in 5 min → Slack

### Tracing
- Future: OpenTelemetry → Honeycomb (Year 2)

---

## 12. Security checklist

- [ ] All endpoints behind auth except `/api/billing/webhook` (Stripe sig verified) và `/health`
- [ ] CSRF protection: SameSite=Lax cookies
- [ ] Rate limit per endpoint (Upstash Redis)
- [ ] Input validation: Zod schemas on every endpoint
- [ ] SQL injection: Use Supabase parameterized queries only
- [ ] XSS: React escapes by default; sanitize Markdown rendering
- [ ] CSP enforced (đã có trong `vercel.json`)
- [ ] Secrets in Vercel env vars only (never commit)
- [ ] PII detection runs on all uploaded designs (`shared/lib/piiDetection.ts`)
- [ ] HTTPS only (HSTS preload)
- [ ] CORS whitelist: only `a11y.desygn.ai`, `*.figma.com` for plugin
- [ ] API key rotation: 90-day expiry default
- [ ] Audit logs for all admin actions
- [ ] Penetration test before launch (use `pentest@hackerone.com`)

---

## 13. Disaster recovery

### Backups
- Supabase auto-backup daily (Pro tier)
- Point-in-time recovery up to 7 days
- Weekly export to S3 for long-term archival (90 days)

### Failover
- Vercel multi-region edge by default
- Supabase: single region acceptable for MVP
- Year 2: add read replicas in EU/APAC for data residency

### Incident response
- Runbook in `docs/runbook/`
- Status page: status.desygn.ai (Statuspage.io or self-hosted)
- SLA breaches: credit to enterprise customers (1 day downtime = 1 month credit)
