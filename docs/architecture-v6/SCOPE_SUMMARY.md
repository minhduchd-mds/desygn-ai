# Desygn A11y Move 1 — Scope Summary

> **For:** Minh Đức (Owner) — required approval per Task 0.3 in `07-implementation-roadmap.md`
> **Author:** Claude Code
> **Date:** 2026-05-20
> **Status:** Awaiting owner sign-off before Week 1 kickoff

---

## 1. Mục tiêu Move 1

Xây dựng **Desygn A11y** — Accessibility-as-a-Service SaaS — leveraging existing `Design-md-ai` codebase (Plugin Figma + AccessibilityAgent.ts + Supabase schema + 22-agent fleet).

**Deliverable Move 1 (Week 16):**
- 4 pricing tiers sellable (Free / Pro $29 / Team $299 / Enterprise custom)
- 5 surfaces live: Figma Plugin (existing) + Dashboard SaaS (NEW) + GitHub Action (NEW) + MCP Server (NEW) + PDF Reports (NEW)
- 50+ paying customers, $5k+ MRR
- $1.5M ARR target Year 1

## 2. Tech stack quyết định (theo docs)

| Layer | Choice | Note |
|---|---|---|
| Framework | React 19 + **TanStack Start** | File-based routing, native SSR |
| Build | Vite 6 | Đã có sẵn |
| Lang | TypeScript 5.7 strict | Đã có sẵn |
| Pkg mgr | **npm workspaces** | Repo đang dùng npm (docs viết pnpm — sẽ stay npm để consistent) |
| DB/Auth | Supabase (Postgres + RLS + Auth) | Đã có 4 migrations sẵn |
| Queue | Inngest | Bypass Vercel 30s timeout |
| Cache | Upstash Redis | Đã setup ở P2 commit |
| Billing | Stripe + Tax | PCI compliance không tự xử |
| Email | Resend | |
| Errors | Sentry | |
| Analytics | PostHog | |
| State | TanStack Query + Zustand + RHF + Zod | |
| Styling | Tailwind v4 + CSS variables + Radix UI primitives | |

## 3. Scope mới (chia 5 phases × 12 tuần)

### Phase 1 — Foundation (Week 1-3)
- Week 1: Migrations 005-008, JWT auth, Upstash rate limit (đã có), Supabase Auth (Google + GitHub OAuth)
- Week 2: Design system tokens, 10 primitives, Storybook
- Week 3: App shell (sidebar + topbar), auth flow, 6 routes alive

### Phase 2 — Core audit engine (Week 4-6)
- Week 4: `packages/figma-rest-adapter` + `packages/audit-engine` với 7 rules port từ AccessibilityAgent.ts
- Week 5: Inngest job queue, 4 API endpoints (start/status/result/stream)
- Week 6: Audit UI (form, progress SSE, score gauge, issue list)

### Phase 3 — Monetization (Week 7-8)
- Week 7: Stripe integration end-to-end (Checkout, Portal, Webhook, Pricing page)
- Week 8: Tier enforcement, PDF/SARIF report generator với HMAC signing, verification page

### Phase 4 — Distribution (Week 9-10)
- Week 9: Plugin Figma integration (login + audit command) + MCP server publish to npm
- Week 10: GitHub Action với SARIF upload + PR comments

### Phase 5 — Launch (Week 11-12)
- Week 11: Marketing site, onboarding wizard, docs site, blog
- Week 12: Production hardening, pentest, load test, ProductHunt launch

## 4. Reuse vs new code

**Reuse (KHÔNG viết lại):**
- `web/src/ux-checklist/agents/AccessibilityAgent.ts` (401 LOC, 7 capabilities) — wrap in server-side runner
- `web/src/lib/piiDetection.ts` — for PII redaction in reports
- `shared/permissions/permissions.ts` (22 scopes, 9 roles) — RBAC reuse
- Supabase schema 001-004 — extend với 005-008
- `api/lib/rate-limit.ts` Upstash (đã có từ P2)
- `packages/mcp-server` (đã có từ P4 — sẽ extend với a11y audit tool)
- Plugin Figma scan engine production-ready

**New:**
- `apps/a11y-dashboard/` — SaaS dashboard (separate Vite app)
- `apps/marketing/` — Landing page
- `packages/audit-engine/` — Wrap AccessibilityAgent for server-side execution
- `packages/report-generator/` — PDF/SARIF/CSV/MD với HMAC signing
- `packages/figma-rest-adapter/` — REST API client với LRU cache
- `packages/ui/` — Shared design system (Tailwind v4 + Radix)
- `api/a11y/*` — 8 endpoints
- `api/billing/*` — 3 endpoints
- `api/team/*` — 4 endpoints
- `inngest/functions/audit-runner.ts` — long-running audit job
- 4 SQL migrations (005-008): subscriptions, a11y extensions, audit queue, api keys

## 5. Hard constraints (KHÔNG được phá)

1. Plugin Figma hiện tại (`plugin/`) phải tiếp tục chạy
2. Web workspace hiện tại (`web/src/`) phải tiếp tục chạy (Design.md workspace)
3. Reuse `AccessibilityAgent.ts` — đừng viết lại
4. Reuse Supabase schema — extend, không tạo DB mới
5. Tất cả tiền qua Stripe — không tự xử lý PCI
6. Audit results phải reproducible + cacheable (cùng input → cùng output)
7. PDF reports phải HMAC-signed cho compliance pháp lý
8. PII redaction qua `web/src/lib/piiDetection.ts`
9. Rate limit theo tier (Free 5/mo, Pro 100, Team 1000, Enterprise ∞)
10. Mark P-level (P0/P1/P2) trên mọi task

## 6. Week 0 deliverable (CAN do without owner approval)

Các task không cần external accounts/credentials:

- [x] Read all 7 docs trong `docs/architecture-v6/`
- [ ] **THIS DOC** — 1-page scope summary
- [ ] Scaffold `apps/a11y-dashboard/`, `apps/marketing/` (empty Vite skeletons)
- [ ] Scaffold `packages/audit-engine/`, `packages/report-generator/`, `packages/figma-rest-adapter/`, `packages/ui/`
- [ ] Write SQL migration files 005-008 (files only — applied to DB later by owner)
- [ ] Add to root `package.json` workspaces + vitest config
- [ ] Run full test suite (still 1653/1653)
- [ ] Commit "chore: Week 0 scaffolding for Desygn A11y Move 1"

## 7. Owner action items (BLOCKED on Minh Đức)

Trước khi bắt đầu Week 1 code:

- [ ] **Approve this scope document** (sign-off email or commit comment)
- [ ] Create accounts (KHÔNG thể tự làm): Vercel A11y project, Supabase A11y projects (prod + staging), Upstash Redis, Inngest, Stripe (Test mode), Resend, Sentry, PostHog
- [ ] Mua domain `desygn.ai` (nếu chưa có) + DNS `a11y.desygn.ai`, `api.desygn.ai`, `docs.desygn.ai`
- [ ] Add env vars to Vercel (per `04` Section 13 list)
- [ ] Confirm budget ~$50/mo Month 1

## 8. Risks tôi đã thấy

| Risk | Mitigation |
|---|---|
| pnpm vs npm trong docs | Stay với npm để không phá existing workspace. Tất cả `pnpm --filter X` mệnh lệnh đổi thành `npm --workspace X`. |
| AccessibilityAgent dùng SerializedNode type from `shared/types.ts` | Audit-engine package phải import từ `shared/` workspace hoặc duplicate type definitions self-contained. Khuyến nghị: import qua `@shared/*` alias. |
| Existing `mcp-server` (P4) đã dùng zod v4 | A11y mcp-server tools sẽ extend cùng package thay vì tạo package mới — code reuse + 1 SDK. |
| Plugin Figma `findAll` ban | Audit engine server-side dùng REST API (không có ban đó), nhưng phải làm rõ trong contract — không gửi `findAll` calls từ plugin. |
| `web/src/design-md-templates/` folder name | Per P1 deferred decision, folder name KHÔNG đổi. Reference path không liên quan đến Desygn A11y. |
| Bundle size Free tier (Tailwind v4 + Radix + TanStack) | Target <250KB gzip — sẽ benchmark Week 11. Lazy-load heavy features (PDF preview). |

## 9. Câu hỏi cần Minh Đức trả lời trước Week 1

1. **Branch strategy**: Tạo branch mới `feat/a11y-saas` từ main, hay merge trực tiếp vào main qua small PRs?
2. **Test environment**: Có Supabase staging riêng cho A11y, hay reuse production current `Design-md-ai`?
3. **Domain**: `desygn.ai` đã mua chưa? Nếu chưa, tôi có thể dùng `*.vercel.app` cho dev không?
4. **MVP scope cut**: 12 tuần khá tight — có muốn cut feature nào (e.g., GitHub Action lùi Week 13)?
5. **Vietnamese vs English first**: Docs A11y default English. Có muốn add Vietnamese từ Day 1 hay defer Year 2?
6. **Plugin Figma rebrand**: Đổi tên plugin từ "Desygn AI" → "Desygn A11y" (sub-product) hay giữ "Desygn AI" và A11y là tab trong plugin?
7. **WCAG version default**: 2.2 AA (per docs) hay 2.1 AA (broader support)?

---

## 10. Recommended next action

**Để tối ưu time-to-first-customer**, đề xuất execution order:

1. **NGAY** (no owner blocker): Week 0 scaffolding (file structure only, no external services)
2. **SAU APPROVAL** (Week 1): Setup external services + apply migrations + start Phase 1
3. **Daily cadence**: Mỗi sáng đọc roadmap tuần đó, mỗi chiều update CHANGELOG.md

**Nếu owner muốn ship fastest:**
- Cut: GitHub Action (Week 10) → Year 2
- Cut: Marketing site polish (Week 11) → MVP launch với plain landing
- Result: Week 9-10 freed → buffer cho hardening + bug fix

**Nếu owner muốn quality-first:**
- Keep all 12 weeks
- Add Week 13: Beta testing với 10 design partners
- Launch Week 14 với case studies ready

---

**Đợi Minh Đức confirm trước khi tôi bắt đầu Week 1 code.**

Sign-off format: Comment trên commit này hoặc reply trong chat với "✅ Approved" + ý kiến về 7 câu hỏi mục 9.
