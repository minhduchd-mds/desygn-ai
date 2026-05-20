# 07 — Implementation Roadmap (12 tuần)

> Mục đích: Lộ trình triển khai chi tiết cho Claude Code, từ Week 1 đến Week 12. Mỗi tuần có deliverables cụ thể, definition of done, và acceptance criteria. **Không nhảy cóc**. Mỗi tuần tổng kết, đo lường, rồi mới sang tuần kế.

---

## 0. Trước khi bắt đầu (Week 0 — chuẩn bị 3 ngày)

### Task 0.1 — Setup environments (P0)
- [ ] Tạo Vercel project mới: `desygn-a11y` (tách khỏi project hiện tại)
- [ ] Tạo Supabase project mới: `desygn-a11y-prod`, `desygn-a11y-staging`
- [ ] Tạo Upstash Redis instance
- [ ] Tạo Inngest account + project
- [ ] Tạo Stripe account, enable Test mode
- [ ] Tạo Resend account cho email
- [ ] Tạo Sentry project
- [ ] Tạo PostHog project
- [ ] Mua domain `desygn.ai` (nếu chưa có)
- [ ] DNS: `a11y.desygn.ai` → Vercel
- [ ] DNS: `api.desygn.ai` → Vercel (cho REST API)

### Task 0.2 — Repo setup (P0)
- [ ] Tạo branch `feat/a11y-saas` từ main
- [ ] Add `apps/`, `packages/` to `pnpm-workspace.yaml`
- [ ] Scaffold `apps/a11y-dashboard` với Vite + TanStack Start template
- [ ] Scaffold `apps/marketing` với Vite + TanStack Start
- [ ] Scaffold `packages/ui`, `packages/audit-engine`, `packages/report-generator`, `packages/figma-rest-adapter`, `packages/mcp-server`
- [ ] Setup Turbo pipeline với new packages
- [ ] Cập nhật `.gitignore` cho new apps

### Task 0.3 — Owner approval (BẮT BUỘC)
- [ ] Claude Code viết 1-page summary của hiểu biết về 6 files trước
- [ ] Minh Đức duyệt scope và priorities
- [ ] Lock toolchain: package versions trong root `package.json`
- [ ] Confirm budget infra (~$50/mo Month 1)

**Definition of Done Week 0:**
- Tất cả accounts/services tạo xong, credentials lưu trong Vercel env vars
- `pnpm install` ở root chạy thành công với new workspace
- 1-page scope document được approved

---

## 1. Phase 1 — Foundation (Week 1-3)

> Goal: Có infrastructure production-ready trước khi build feature.

### Week 1 — Database & auth foundation

#### Tasks
- [ ] **P0** Apply migrations 005-008 (tài liệu 03 Section 3) tới Supabase staging
- [ ] **P0** Apply migrations tới production sau khi staging test pass
- [ ] **P0** Setup Supabase Auth: enable email/password, Google OAuth, GitHub OAuth
- [ ] **P0** Configure RLS policies cho tất cả new tables
- [ ] **P0** Write seed data script cho `a11y_rules` table (7 rules từ AccessibilityAgent)
- [ ] **P1** Setup `api/lib/auth.ts` JWT verification (tài liệu 03 Section 7)
- [ ] **P1** Setup `api/lib/quota.ts` quota checks
- [ ] **P1** Setup `api/lib/rateLimit.ts` Upstash Redis-based
- [ ] **P2** Write unit tests cho auth + quota
- [ ] **P2** Document env vars in `.env.example`

#### Deliverables
- `supabase/migrations/005-008.sql` applied
- Auth context working in `apps/a11y-dashboard`
- Rate limit returning 429 correctly
- 80%+ test coverage cho `api/lib/`

#### Acceptance criteria
- [ ] Có thể signup/login trong staging
- [ ] JWT verify trả về user context đúng
- [ ] Quota check trả về remaining count đúng
- [ ] Rate limit 100 req/min hoạt động với Upstash

---

### Week 2 — Design system foundation

#### Tasks
- [ ] **P0** Implement design tokens trong `packages/ui/src/tokens/` (tài liệu 05 Sections 2, 3, 4)
- [ ] **P0** Setup Tailwind v4 với CSS variables
- [ ] **P0** Configure dark mode toggle (data-theme attribute)
- [ ] **P0** Build 5 primitives: Button, Input, Card, Dialog, Toast
- [ ] **P1** Setup Storybook trong `packages/ui/`
- [ ] **P1** Build 5 more primitives: Select, Checkbox, Switch, Avatar, Badge
- [ ] **P1** Add Lucide React icons
- [ ] **P2** Add visual regression với Chromatic (free tier)
- [ ] **P2** Write a11y tests cho mỗi primitive (axe-core)

#### Deliverables
- Tokens file với 100+ CSS variables
- 10 primitives ready
- Storybook deployed at `storybook.desygn.ai` (or Vercel preview)
- Dark mode working

#### Acceptance criteria
- [ ] Mỗi primitive có ≥3 variants documented
- [ ] Contrast của tất cả color combos ≥ 4.5:1
- [ ] Keyboard nav hoạt động trong mỗi component
- [ ] Storybook a11y addon: 0 violations

---

### Week 3 — App shell + routing

#### Tasks
- [ ] **P0** Build app shell layout (sidebar + topbar) — tài liệu 04 Section 3
- [ ] **P0** Implement TanStack Router file-based routes
- [ ] **P0** Protected route wrapper với redirect to /login
- [ ] **P0** Login page với email + Google
- [ ] **P0** Signup page với verification email
- [ ] **P1** Forgot password flow
- [ ] **P1** Settings/profile page
- [ ] **P1** Sidebar navigation với active state
- [ ] **P2** Cmd+K command palette (basic)
- [ ] **P2** Skeleton loaders trong shell

#### Deliverables
- App shell deployed at staging
- Auth flow end-to-end (signup → verify → login → dashboard)
- 6 routes alive (4 public + 2 app)

#### Acceptance criteria
- [ ] Signup → verify email → login → land on /dashboard
- [ ] Logout clears session, redirects to /
- [ ] Refresh page keeps session
- [ ] All routes pass Lighthouse a11y ≥ 95
- [ ] LCP < 1.5s on Vercel preview

---

## 2. Phase 2 — Core audit engine (Week 4-6)

> Goal: Audit từ Figma → result → save to DB. Đây là core của product.

### Week 4 — Audit engine + Figma adapter

#### Tasks
- [ ] **P0** Build `packages/figma-rest-adapter/` (tài liệu 03 Section 5)
  - REST client với token auth
  - `getFile()` với batch nodes
  - `getImages()` cho screenshots
  - In-memory cache (LRU)
- [ ] **P0** Build `packages/audit-engine/` core class
  - `AuditEngine.run()` orchestrator
  - Rule interface
  - Issue aggregation
  - Scoring algorithm
- [ ] **P0** Port 3 rules từ existing `AccessibilityAgent.ts`:
  - `rules/contrast.ts`
  - `rules/touch-target.ts`
  - `rules/aria.ts`
- [ ] **P1** Port remaining 4 rules:
  - `rules/keyboard.ts`
  - `rules/heading.ts`
  - `rules/motion.ts`
  - `rules/semantic.ts`
- [ ] **P1** Unit tests cho mỗi rule (10+ test cases each)
- [ ] **P2** Benchmark: 100 nodes audit < 2s, 1000 nodes < 15s

#### Deliverables
- `packages/figma-rest-adapter` published trong workspace
- `packages/audit-engine` với 7 rules
- Test suite ≥80% coverage

#### Acceptance criteria
- [ ] Audit của test Figma file return correct WCAG score
- [ ] Each rule independent + parallel-safe
- [ ] No `any` types
- [ ] Cùng input → cùng output (reproducibility)

---

### Week 5 — Audit job queue (Inngest)

#### Tasks
- [ ] **P0** Setup Inngest client + dev server
- [ ] **P0** Create `audit-runner` function (tài liệu 03 Section 6)
- [ ] **P0** Endpoint `POST /api/a11y/audit-start` → enqueue
- [ ] **P0** Endpoint `GET /api/a11y/audit-status?id=`
- [ ] **P0** Endpoint `GET /api/a11y/audit-result?id=`
- [ ] **P1** SSE endpoint `GET /api/a11y/audit-stream?id=`
- [ ] **P1** Progress events từ engine → Inngest → SSE
- [ ] **P1** Retry logic cho failed audits (3 attempts)
- [ ] **P2** Checksum-based dedup (skip nếu audit cùng input < 1h trước)

#### Deliverables
- Inngest function deployed
- 4 endpoints live
- Audit từ start → finish < 30s cho 500 nodes

#### Acceptance criteria
- [ ] POST audit-start return audit ID < 500ms
- [ ] Audit completes within budget (P95 < 30s for 500 nodes)
- [ ] SSE stream emit ≥1 progress event/giây
- [ ] Failed audit retries automatically
- [ ] Duplicate audit (same checksum) returns cached result in <100ms

---

### Week 6 — Audit UI

#### Tasks
- [ ] **P0** Build `AuditStartForm` (tài liệu 04 Section 4)
  - Figma URL input + validation
  - WCAG version/level selector
  - Submit + redirect to detail page
- [ ] **P0** Build `AuditDetailPage` route
- [ ] **P0** Build `AuditProgressIndicator` với SSE subscription
- [ ] **P0** Build `AuditScoreGauge` (donut chart)
- [ ] **P1** Build `IssueList` với virtualization (>50 issues)
- [ ] **P1** Build `IssueDetailPanel` slide-out
- [ ] **P1** Build `AuditList` page với pagination
- [ ] **P2** Build `SeverityBadge`, `WcagBadge` primitives
- [ ] **P2** Empty states cho 0 audits, 0 issues

#### Deliverables
- Audit start → progress → result flow complete
- AuditList page với 50 audits/page
- All UI components in Storybook

#### Acceptance criteria
- [ ] User submit Figma URL → see progress → see results within budget
- [ ] Issue list virtualized (500+ items không lag)
- [ ] Score gauge animate from 0 → final value
- [ ] Lighthouse perf ≥ 90 on /audits/[id]
- [ ] LCP < 1.5s khi audit cached

---

## 3. Phase 3 — Monetization (Week 7-8)

> Goal: Có thể nhận tiền. Stripe + tier enforcement.

### Week 7 — Stripe integration

#### Tasks
- [ ] **P0** Setup Stripe products + prices in Test mode (tài liệu 03 Section 8)
- [ ] **P0** Implement `POST /api/billing/checkout`
- [ ] **P0** Implement `POST /api/billing/portal`
- [ ] **P0** Implement `POST /api/billing/webhook` cho `customer.subscription.*`
- [ ] **P0** Update `subscriptions` table on webhook
- [ ] **P1** Pricing page build (tài liệu 05 Section 14 mockup)
- [ ] **P1** Upgrade prompt component (shown when hit quota)
- [ ] **P1** Billing page in dashboard (subscription, invoices, payment method)
- [ ] **P1** Email notifications (Resend): welcome, payment confirmed, payment failed
- [ ] **P2** Annual vs monthly toggle on pricing
- [ ] **P2** Stripe Tax enabled cho EU VAT

#### Deliverables
- Stripe Checkout working end-to-end
- Webhook handler updating subscription state
- Pricing page deployed
- Email flows working

#### Acceptance criteria
- [ ] Click "Start Pro" → Stripe Checkout → success → subscription `active` in DB
- [ ] Webhook receives + processes events idempotently
- [ ] Failed payment dunning works (3 retries)
- [ ] Cancel subscription → status `canceled`, access until period end
- [ ] Test mode: 100% scenarios work before flipping live

---

### Week 8 — Tier enforcement + reports

#### Tasks
- [ ] **P0** Enforce quota check in `POST /api/a11y/audit-start` (Free: 5/mo)
- [ ] **P0** Build `packages/report-generator/` (tài liệu 03 Section 9)
  - PDF template with @react-pdf/renderer
  - Markdown export
  - JSON/SARIF export
- [ ] **P0** PDF signing với HMAC-SHA256
- [ ] **P0** Endpoint `GET /api/a11y/report-pdf?id=` (Pro+ only)
- [ ] **P1** Endpoint `GET /api/a11y/report-sarif?id=`
- [ ] **P1** Build PDF verification page `/verify`
- [ ] **P1** Branding tuỳ chỉnh (logo + company name) cho Pro+
- [ ] **P1** `ReportExportMenu` component trong AuditDetailPage
- [ ] **P2** Watermark "Powered by Desygn A11y" cho Free tier
- [ ] **P2** Usage meter component (audits used / limit)

#### Deliverables
- Free tier limited to 5 audits/month
- Pro tier: unlimited PDF export, no watermark
- PDF reports signed + verifiable
- All 4 export formats work

#### Acceptance criteria
- [ ] Free user 6th audit → see upgrade prompt, audit not started
- [ ] Pro user: download PDF < 5s
- [ ] PDF verification page: upload PDF → "Valid/Invalid" result
- [ ] SARIF format valid (test với SARIF validator)
- [ ] Free tier PDF has watermark, Pro doesn't

---

## 4. Phase 4 — Distribution channels (Week 9-10)

> Goal: Gặp user ở chỗ họ làm việc — Figma, GitHub, AI coding tools.

### Week 9 — Figma plugin integration + MCP server

#### Tasks
- [ ] **P0** Update existing Figma plugin để gọi Desygn A11y API
  - Add login flow (deep link → dashboard → token)
  - Add "Audit with Desygn A11y" command
  - Show audit result in plugin UI
- [ ] **P0** Build `packages/mcp-server/` (tài liệu 03 Section 10)
  - Tool: `audit_figma_for_a11y`
  - Tool: `get_audit_report`
  - Tool: `list_audits`
- [ ] **P1** Publish MCP server to npm: `@desygn/mcp-a11y`
- [ ] **P1** Submit MCP server to Anthropic registry
- [ ] **P1** Plugin: link audit results back to plugin (deep link)
- [ ] **P2** Plugin: re-design UI với tokens mới
- [ ] **P2** Update plugin manifest for Figma Community submission

#### Deliverables
- Plugin gọi Desygn A11y API thành công
- MCP server published trên npm
- Plugin submitted to Figma Community

#### Acceptance criteria
- [ ] Plugin: click "Audit" → audit chạy → kết quả hiện trong plugin
- [ ] Plugin: results clickable → open dashboard chi tiết
- [ ] MCP server: `npx @desygn/mcp-a11y` chạy được
- [ ] MCP tool callable từ Cursor/Claude Code

---

### Week 10 — GitHub Action

#### Tasks
- [ ] **P0** Build `.github/actions/desygn-a11y/` action
  - Input: Figma URL, WCAG version
  - Output: SARIF file uploaded to GitHub Code Scanning
- [ ] **P0** Webhook receiver `POST /api/a11y/webhook`
- [ ] **P0** Auto-detect Figma link trong PR description
- [ ] **P1** PR comment với audit summary
- [ ] **P1** Block PR merge nếu score < threshold (configurable)
- [ ] **P1** Documentation cho Action setup
- [ ] **P2** Public marketplace listing trên GitHub Marketplace

#### Deliverables
- GitHub Action public
- 5+ minute setup-to-first-audit time
- PR comments working

#### Acceptance criteria
- [ ] Add Action to repo → 5 min setup → first audit on PR
- [ ] PR comment shows score + top 3 issues
- [ ] SARIF results visible trong GitHub Security tab
- [ ] Score threshold gating works

---

## 5. Phase 5 — Polish & launch prep (Week 11-12)

### Week 11 — Marketing site + onboarding

#### Tasks
- [ ] **P0** Build marketing landing page (`apps/marketing/`)
  - Hero, features, pricing, FAQ
  - Customer logos (need 3 design partners first)
  - "Install plugin" CTA
- [ ] **P0** Build onboarding flow (first-time user)
  - 3-step wizard: connect Figma → first audit → view results
  - Sample Figma file để user audit ngay (no setup)
- [ ] **P1** Documentation site at `docs.desygn.ai`
  - Getting started
  - WCAG rule reference
  - API reference (auto-gen từ OpenAPI)
  - Integration guides
- [ ] **P1** Blog setup at `blog.desygn.ai`
  - First 3 posts: "EU Accessibility Act guide", "axe vs Stark vs Desygn", "How to read a WCAG report"
- [ ] **P2** Public case study trang (sau khi có 3 design partners)
- [ ] **P2** Help center embed (intercom hoặc plain docs)

#### Deliverables
- Landing page live at `a11y.desygn.ai`
- Docs live at `docs.desygn.ai`
- Blog live at `blog.desygn.ai`
- Onboarding wizard tested

#### Acceptance criteria
- [ ] Landing Lighthouse: Performance 95+, Accessibility 100, SEO 100
- [ ] Onboarding: 60%+ users complete first audit
- [ ] Docs: search works, all internal links valid
- [ ] Blog SEO: meta tags, sitemap, RSS feed

---

### Week 12 — Production hardening & launch

#### Tasks
- [ ] **P0** Switch Stripe to Live mode
- [ ] **P0** Audit security checklist (tài liệu 03 Section 12)
- [ ] **P0** Pentest by external (HackerOne or Cobalt) — basic scan
- [ ] **P0** Load test với k6 (target từ tài liệu 06 Section 9)
- [ ] **P0** Setup monitoring alerts (Sentry + PostHog)
- [ ] **P0** Setup status page (statuspage.io free)
- [ ] **P1** Backup verification: restore from staging backup successfully
- [ ] **P1** Runbook docs for common incidents
- [ ] **P1** Legal: Terms of Service, Privacy Policy, DPA reviewed by lawyer
- [ ] **P1** GDPR cookie consent banner
- [ ] **P2** ProductHunt launch prep: assets, copy, hunter outreach
- [ ] **P2** Email 100 beta testers từ waiting list

#### Deliverables
- Production live, hardened
- ProductHunt launch ready
- 10 active design partners onboarded

#### Acceptance criteria
- [ ] Load test: 50 RPS sustained, P95 < 500ms
- [ ] Pentest: no critical or high findings
- [ ] Error rate < 0.5% production
- [ ] First paying customer (any tier)

---

## 6. Post-launch (Week 13+) — Plan briefly

### Week 13-16 — Iteration

- Listen to user feedback (PostHog interviews + Intercom chats)
- Fix top 10 bugs from user reports
- Build top 3 requested features
- Hire freelance writer cho blog (4 posts/month)
- Start outbound to enterprise: 50 cold emails/week

### Month 4-6 — Move 1 expansion

- Build Cursor/VS Code extension (Move 3 from review trước)
- Mobile-first audit features
- Team analytics dashboard
- SSO via Google Workspace/Microsoft 365

### Month 7-12 — Scale

- Enterprise tier features: SAML, SOC2, data residency
- White-label option for consultancies
- Custom WCAG framework support (Section 508, ADA, JIS X 8341)
- APAC i18n (ko, zh-CN, zh-TW, th, id)
- Begin Move 2 R&D (bidirectional design ↔ code sync)

---

## 7. Cross-cutting concerns (every week)

### Daily
- [ ] Check Sentry for new errors
- [ ] Check status of running audits (Inngest dashboard)
- [ ] Respond to support emails within 24h

### Weekly
- [ ] Friday: PostHog review — DAU, retention, top features used
- [ ] Friday: Update CHANGELOG.md
- [ ] Friday: Deploy to staging Monday → production Wednesday cadence
- [ ] Friday: 1-on-1 với top 3 active users (or async survey)

### Per release
- [ ] All tests pass (unit + e2e)
- [ ] Lighthouse CI pass
- [ ] Visual regression pass (Chromatic)
- [ ] Bundle size < budget
- [ ] Changelog updated
- [ ] Migrations applied to staging first

### Quality bar (always)
- TypeScript strict, no `any`
- No new prod `console.log`
- All new endpoints have Zod schema + rate limit
- All new components have Storybook + a11y test
- All new DB columns have RLS policy + index if filtered
- All new env vars in `.env.example`
- All new features tested manually before merge

---

## 8. Risk register

### Risk: Inngest free tier exceeded
**Trigger**: > 50k steps/month
**Mitigation**: Move to Pro $20/mo at 80% utilization

### Risk: Vercel function timeout (30s) hit
**Trigger**: Audit job > 30s for large files
**Mitigation**: Already mitigated by Inngest. If any sync endpoint hits, refactor to async.

### Risk: Supabase auth rate limit
**Trigger**: > 30 signups/hour from single IP (spam)
**Mitigation**: Cloudflare Turnstile on signup form

### Risk: Stripe webhook delivery failure
**Trigger**: Webhook endpoint 5xx
**Mitigation**: Stripe auto-retries 3 days. Add idempotency keys.

### Risk: Figma API rate limit
**Trigger**: > 100 requests/sec per token
**Mitigation**: Per-user rate limit, queue batching. Each customer uses own token.

### Risk: PDF generation OOM (Vercel function)
**Trigger**: Report > 100 pages
**Mitigation**: Move PDF gen to Inngest job, stream output, paginate large reports

### Risk: Lawsuit về claim "WCAG compliant"
**Trigger**: Customer sued, blames Desygn audit
**Mitigation**: Clear disclaimers, professional liability insurance ($1M policy ~$2k/yr)

---

## 9. Definition of "done" cho Move 1

Khi nào declare "Move 1 done"?

✅ All 4 tiers (Free, Pro, Team, Enterprise) sellable
✅ All 5 capabilities live (Figma plugin, Dashboard, GitHub Action, MCP server, PDF reports)
✅ 50+ paying customers
✅ $5k+ MRR
✅ Lighthouse 95+ on all key pages
✅ < 0.5% error rate over 30 days
✅ First enterprise contract signed (or LOI)
✅ SOC2 Type I report scheduled (Type II in Year 2)

**Expected timeline:** End of Month 4 (Week 16).

---

## 10. Cách Claude Code dùng tài liệu này

### Mỗi Monday morning
1. Mở tài liệu 07 (file này)
2. Đọc tasks của week hiện tại
3. Confirm với Minh Đức scope cụ thể
4. Break each P0 task → subtasks ≤ 4h each
5. Estimate completion by Thursday EOD

### Mỗi Friday EOD
1. Mark tasks as done/in-progress
2. Update CHANGELOG.md
3. Deploy passing PRs to staging
4. Schedule prod deploy for Wednesday next week
5. Note any blockers for next week

### Khi gặp ambiguity
1. KHÔNG tự quyết lớn (DB schema, API contract, pricing)
2. Stop, ask Minh Đức trong Vietnamese
3. Default về **simplest viable** nếu không thể hỏi

### Khi scope creep
1. Flag: "Task X cần thêm Y, không nằm trong tuần này"
2. Đề xuất: defer hoặc reschedule
3. Không tự ý expand

### Khi tìm bug critical
1. Stop current work
2. File issue with reproduction steps
3. Ping Minh Đức ngay
4. Hotfix nếu prod ảnh hưởng

---

## 11. Final checklist trước Week 1 kickoff

- [ ] All 7 docs (`01-overview` to `07-implementation-roadmap`) read end-to-end
- [ ] Code review trước (`CODEBASE_REVIEW.md`) cũng đọc qua
- [ ] Existing codebase `Design-md-ai-main/` cloned + `pnpm install` works
- [ ] Vercel + Supabase + Stripe accounts ready
- [ ] Minh Đức approve scope của Week 1
- [ ] Slack/Discord channel cho daily updates (optional)
- [ ] Backup plan if Claude Code hits context limit → break vào phases nhỏ hơn

**Good luck. Build something users love.**

---

## 12. Reference back to other docs

| Question | Read |
|---|---|
| What is Desygn A11y? | `01-overview.md` |
| Why Move 1 over Move 2/3? | `01-overview.md` Section 0 |
| Who are the users? | `01-overview.md` Section 2 |
| Pricing details? | `02-business-model.md` Section 1 |
| TAM/SAM/SOM? | `02-business-model.md` Section 2 |
| How to acquire customers? | `02-business-model.md` Section 3 |
| Database schema? | `03-backend-architecture.md` Section 3 |
| API endpoints? | `03-backend-architecture.md` Section 4 |
| Stripe integration? | `03-backend-architecture.md` Section 8 |
| Audit queue (Inngest)? | `03-backend-architecture.md` Section 6 |
| Frontend tech stack? | `04-frontend-architecture.md` Section 2 |
| Routes structure? | `04-frontend-architecture.md` Section 3 |
| Component patterns? | `04-frontend-architecture.md` Section 4 |
| State management? | `04-frontend-architecture.md` Section 5 |
| Color tokens? | `05-web-template-redesign.md` Section 2 |
| Typography? | `05-web-template-redesign.md` Section 3 |
| Component visual specs? | `05-web-template-redesign.md` Section 6 |
| Performance budgets? | `06-performance.md` Section 1 |
| Audit optimization? | `06-performance.md` Section 2 |
| Caching strategy? | `06-performance.md` Section 4 |
| Load testing? | `06-performance.md` Section 9 |
