# 02 — Business Model & Pricing

## 1. Pricing tiers

### Tier 1 — Free
**Mục đích:** Acquisition funnel + community goodwill.
**Giá:** $0

**Bao gồm:**
- Plugin Figma (full features)
- 5 audits/tháng trên dashboard SaaS
- WCAG 2.2 AA check
- Markdown report (không có PDF signed)
- 1 project
- 7-day retention cho audit history
- Community support (GitHub Discussions)
- Watermark "Powered by Desygn A11y" trên report

**Limit kỹ thuật:**
- Max 50 pages/frames per audit
- Max 100 nodes total per frame
- 1 user
- Không có API access
- Rate limit: 5 audit/30 ngày sliding window

### Tier 2 — Pro
**Mục đích:** Indie designers, freelancers, small teams.
**Giá:** $29/tháng hoặc $290/năm (save 17%)

**Bao gồm:** Tất cả Free, cộng thêm:
- 100 audits/tháng
- WCAG 2.1 AA, 2.2 AA, 2.2 AAA
- PDF signed report (không watermark)
- 10 projects
- 90-day retention
- Email support (48h SLA)
- API access (rate limited: 100 req/giờ)
- 1 GitHub Action workflow
- Export báo cáo dưới: PDF, JSON, SARIF, CSV
- Branding tuỳ chỉnh report (logo + tên company)

**Target:** 800 users by Q4 = $23,200 MRR

### Tier 3 — Team
**Mục đích:** Design system teams, mid-size companies.
**Giá:** $299/tháng (5 seats included) + $59/seat/tháng thêm. Annual: $2,990 (5 seats) save 17%.

**Bao gồm:** Tất cả Pro, cộng thêm:
- 1,000 audits/tháng (pooled across team)
- Unlimited projects
- 365-day retention
- Priority support (24h SLA)
- API rate limit: 1,000 req/giờ
- Unlimited GitHub Action workflows
- Slack/Teams integration
- Custom WCAG rule sets (e.g., chỉ check rules áp dụng cho fintech)
- Team analytics dashboard
- Audit log (ai làm gì khi nào)
- SSO via Google Workspace, Microsoft 365
- Role-based access (Owner/Admin/Editor/Viewer)

**Target:** 100 teams by Q4 = $29,900 MRR + expansion seats

### Tier 4 — Enterprise
**Mục đích:** Fortune 5000, regulated industries (fintech, healthtech, gov).
**Giá:** Custom. Starting $2,999/tháng. Đa số deals $50k-$200k ARR.

**Bao gồm:** Tất cả Team, cộng thêm:
- Unlimited audits
- Unlimited seats
- Unlimited retention
- Dedicated customer success manager
- 99.9% SLA với contract
- SSO via SAML, Okta, Azure AD
- SOC2 Type II report
- GDPR DPA + signed BAA (cho healthcare)
- On-prem deployment option (+$30k setup)
- Custom WCAG framework (e.g., Section 508, ADA, JIS X 8341)
- White-label option (rebrand to internal tool)
- Audit data residency (EU/US/APAC regions)
- Quarterly business review
- Custom integration development (1 included/năm)

**Target:** 20 enterprises by Q4 = average $7,500 MRR × 20 = $150,000 MRR

### Tier add-on — Compliance Bundle
**Phí một lần:** $1,500
- Audit toàn bộ design system hiện tại (no token limit)
- Compliance gap report ký bởi WCAG expert
- 30-min consultation
- Custom remediation roadmap

**Target:** 30 bundles năm 1 = $45,000 ARR one-time

---

## 2. Total Addressable Market (TAM)

### Bottom-up calculation

**Pro tier:**
- Freelance designers WW: ~2M
- Có Figma + nghiêm túc về a11y: ~5% = 100k
- Conversion rate target: 1% = 1,000 users
- ARPU: $290/năm
- Pro TAM: $290k ARR

**Team tier:**
- Mid-size companies có design system: ~50k WW
- Có compliance pressure (EU/US regulated): ~30% = 15k
- Conversion target: 2% = 300 teams
- ARPU: $4,000/năm (avg 6 seats)
- Team TAM: $1.2M ARR

**Enterprise:**
- Companies với >5,000 employees: ~12k WW
- Có digital products B2C trong EU/US: ~50% = 6k
- Conversion target: 0.5% = 30 enterprises
- ARPU: $90k/năm
- Enterprise TAM: $2.7M ARR

**Tổng TAM Year 1 conservative:** $4.2M ARR
**Realistic Year 1 target:** $1.5M ARR (35% of TAM)
**Stretch Year 1 target:** $2.5M ARR

---

## 3. Customer acquisition channels

### Channel 1 — Plugin Figma Community (free → paid funnel)

**Strategy:** Plugin Figma là acquisition machine. Mỗi user install → onboarded vào ecosystem.

**Actions:**
1. Submit plugin lên Figma Community (đã có manifest)
2. Naming: "Desygn A11y — Accessibility Audit"
3. Description optimized for Figma search: "WCAG 2.2 AA AAA audit, contrast checker, touch target validator..."
4. Screenshot/video demo high quality
5. Free tier offers immediate value
6. Onboarding modal trong plugin: "Upgrade to Pro to remove watermark"

**Target:** 10k installs in Year 1, 5% convert to Pro = 500 paid users.

### Channel 2 — SEO + Content marketing

**Topics đánh target:**
- "How to audit Figma for WCAG 2.2 compliance" (HVK keyword)
- "EU Accessibility Act checklist for digital products"
- "axe-core vs Stark vs Desygn A11y comparison"
- "5 most common a11y issues in design systems"
- "Why post-launch a11y fixes cost 10× more"

**Distribution:**
- Blog tại `blog.desygn.ai/a11y`
- Cross-post Dev.to, Hashnode, LinkedIn Articles
- Newsletter "A11y Digest" (monthly)

**Investment:** 8 hours/week content. ROI 9 tháng.

### Channel 3 — Partner integrations

**Targets:**
- **Figma**: Officially listed plugin (đã planned)
- **Cursor**: Featured trong MCP marketplace (sẽ launch Q2)
- **Anthropic**: Submit cho Claude Skills marketplace
- **GitHub Marketplace**: Action listing
- **Vercel Integrations**: One-click setup

**Effort:** 2 weeks per integration. ROI: traffic + credibility.

### Channel 4 — Compliance community

**Tactics:**
- Speak at W3C events
- Sponsor Smashing Conf (a11y track)
- Webinar "WCAG 2.2 changes designers need to know"
- Free A11y maturity assessment for nonprofit
- Pro bono audits for accessibility advocacy orgs (in exchange for case study)

**Investment:** $20k Year 1. ROI: enterprise pipeline.

### Channel 5 — Comparison content + paid search

**Long tail keywords:**
- "Stark alternative"
- "axe DevTools alternative free"
- "Figma a11y audit tool"

**Google Ads budget:** $3k/tháng cho first 6 months. Convert 1% → 50 trials → 15 paid = $4,350 MRR. Payback ~2 tháng.

---

## 4. Conversion funnel

```
                        Awareness (organic + paid)
                                  │
                                  ▼
                  Land on a11y.desygn.ai (10k visitors/mo)
                                  │
                                  ▼ 30%
                       Install Figma plugin (3k installs/mo)
                                  │
                                  ▼ 60%
                          Run first audit (1,800/mo)
                                  │
                                  ▼ 40%
                          Run 5th audit (720/mo)
                                  │
                                  ▼ 15% (limit hit)
                       Upgrade prompt shown (108/mo)
                                  │
                                  ▼ 25%
                            Start Pro trial (27/mo)
                                  │
                                  ▼ 70%
                              Convert paid (19/mo)
                                  │
                                  ▼
                       19 Pro users/month = $551 MRR
```

**Realistic numbers cho Month 6:** ~150 Pro users → $4.4k MRR from Pro alone. Team + Enterprise add 3-5× on top.

---

## 5. Pricing psychology

### Why $29 (không phải $19 hay $39)

- $19 quá thấp → perception "đồ rẻ", churn cao
- $39 đụng pricing Stark Pro ($39) → đứng giữa pricing ladder
- $29 = mức "no-brainer" cho freelancer → expense report dưới ngưỡng need approval

### Why $299 (không phải $199 hay $499)

- $199 → user expect 1-2 seats only
- $499 → barrier cho mid-size company
- $299 + 5 seats included → mỗi seat hiệu quả $60 → cạnh tranh axe DevTools $39/seat

### Annual discount 17%

Standard SaaS practice (2 months free). Improves cashflow + reduces churn.

### Volume discount (Team tier)

- Seats 5-10: $59/seat
- Seats 11-25: $49/seat (-17%)
- Seats 26-50: $39/seat (-34%)
- Seats 51+: $29/seat (-51%)

Khuyến khích teams lớn upgrade Enterprise instead of buying lots of seats.

---

## 6. Unit economics

### Pro tier per-user

| Metric | Value |
|---|---|
| ARPU/month | $29 |
| Gross margin | 88% ($25.50) |
| CAC (blended) | $80 |
| Payback period | 3.1 months |
| Average lifetime | 22 months |
| LTV | $561 |
| LTV/CAC ratio | 7.0× |

**Target:** LTV/CAC > 3× (healthy). Current model 7× → very strong.

### Team tier per-account

| Metric | Value |
|---|---|
| ARPU/month | $499 (avg 8 seats) |
| Gross margin | 91% ($454) |
| CAC | $1,200 (sales-assisted) |
| Payback period | 2.6 months |
| Average lifetime | 28 months |
| LTV | $12,712 |
| LTV/CAC ratio | 10.6× |

### Enterprise per-account

| Metric | Value |
|---|---|
| ARPU/month | $7,500 |
| Gross margin | 80% (more support cost) |
| CAC | $25,000 (sales cycle 4 months) |
| Payback period | 4.2 months |
| Average lifetime | 36 months |
| LTV | $216,000 |
| LTV/CAC ratio | 8.6× |

---

## 7. Cost structure

### Variable costs per audit

| Cost | Amount | Notes |
|---|---|---|
| Compute (Vercel Edge) | $0.001 | Avg 200ms execution |
| Storage (Supabase) | $0.0001 | 50KB report avg |
| AI inference (Groq) | $0.002 | Optional AI suggestions, ~500 tokens |
| Stripe fee | 2.9% + $0.30 | Card processing |
| **Total/audit** | **~$0.015** | Excluding Stripe |

### Fixed costs (Month 6 estimate)

| Cost | Amount |
|---|---|
| Vercel Pro | $200 |
| Supabase Pro | $25 + usage ($50) |
| Upstash Redis | $25 |
| Resend (email) | $20 |
| Sentry | $26 |
| PostHog | $0 (under 1M events) |
| Domain + SSL | $10 |
| Stripe Atlas (if incorporating US) | $500/year |
| **Total monthly** | **~$350** |

**Operating margin Month 6:** Revenue $13,500 - costs $350 - human cost (you) = ~95% gross, ~70% net after factoring time.

---

## 8. Pricing page strategy

### Above the fold
```
┌─────────────────────────────────────────────────────────┐
│  Catch WCAG violations 10× cheaper, in Figma.            │
│                                                           │
│  Start free. No credit card. 1-click install.             │
│                                                           │
│  [Install Plugin] [Try Online Demo]                      │
└─────────────────────────────────────────────────────────┘
```

### Trust indicators

- "Used by teams at [Logo Logo Logo]" (cần get 3 design partners trước launch)
- "Trusted by 5,000+ designers"
- "GDPR + SOC2 compliant"
- "$5M in lawsuit costs prevented"

### Pricing table

| Feature | Free | Pro | Team | Enterprise |
|---|---|---|---|---|
| Audits/mo | 5 | 100 | 1,000 | ∞ |
| WCAG version | 2.2 AA | 2.1+2.2 AA/AAA | All | Custom |
| PDF signed | ❌ | ✅ | ✅ | ✅ |
| Projects | 1 | 10 | ∞ | ∞ |
| Retention | 7d | 90d | 365d | ∞ |
| Seats | 1 | 1 | 5+$59/seat | ∞ |
| Support | Community | Email 48h | Priority 24h | Dedicated CSM |
| API | ❌ | ✅ | ✅ | ✅ |
| SSO | ❌ | ❌ | Google/MS | SAML/Okta |
| SOC2 | ❌ | ❌ | ❌ | ✅ |
| **Price** | **$0** | **$29/mo** | **$299/mo** | **Custom** |

### FAQs phải có

1. "Is this WCAG compliant?" → Yes, audit follows WCAG 2.2 AA + AAA spec
2. "Can I use the report in court?" → Yes for Pro+, signed PDF
3. "Do you support [enterprise SSO]?" → Yes for Team+ (Google/MS), Enterprise (SAML/Okta)
4. "Can I cancel anytime?" → Yes, no contracts
5. "What if I need more than 1000 audits?" → Talk to sales
6. "Do you sell my Figma data?" → No, ever. Auditing happens isolated, data deleted after retention period.

---

## 9. Sales process by tier

### Free / Pro: Self-serve
- Sign up → install plugin → run audit → upgrade prompt → Stripe checkout
- Zero human touch
- Email drip campaign for activated free users

### Team: Self-serve + light touch
- Sign up team → free trial 14 days
- Day 3: Email "Schedule onboarding call"
- Day 7: In-app prompt + email
- Day 13: "Trial ending" notification
- Day 14: Convert or auto-pause
- Optional Calendly link for 30-min demo

### Enterprise: Full sales cycle
- Lead source: inbound demo request / outbound BDR
- Stage 1: Discovery call (30 min)
- Stage 2: Technical evaluation (POC 4 weeks, 1 designer + 1 dev from customer side)
- Stage 3: Procurement (legal review DPA, MSA, etc.)
- Stage 4: Implementation (kick-off + training)
- Stage 5: Quarterly business review
- Total cycle: 4-6 months
- Conversion rate: 25% from POC

---

## 10. Customer success / retention

### Onboarding (first 14 days)
- Day 0: Welcome email + Quick Start Guide
- Day 1: Tutorial video "Your first audit in 3 minutes"
- Day 3: Tip "Did you know? You can audit on every PR with our GitHub Action"
- Day 7: Check-in email "Need help? Reply to this email"
- Day 14: Survey "How likely to recommend Desygn A11y? (0-10)"

### Retention drivers
- **Weekly digest email** (opt-in): "You caught 23 issues this week, saving ~$11,500"
- **Streak gamification**: Audit every week → badge
- **Comparison reports**: "Your team is in top 15% for a11y compliance"
- **Quarterly compliance score**: PDF báo cáo "Q3 compliance: 87%, +12% vs Q2"

### Churn signals (monitor)
- No audit in 30 days → "We miss you" email + free month offer
- Failed payment → Retry 3× over 7 days, then dunning flow
- Downgrade → Exit survey

---

## 11. Partnerships strategy

### Strategic partners (tận dụng):

**1. Figma**
- Plugin verified status
- Partner Spotlight feature
- Co-marketing content "How [Company] uses Desygn A11y"

**2. Anthropic**
- MCP server listed officially
- Co-author "WCAG with Claude" guide
- Case study

**3. WCAG-related orgs (Deque, IAAP)**
- Cross-promote
- Certification badges
- Speak at their conferences

### Affiliate program

- 30% recurring commission first year
- 10% from year 2
- Cookie: 60 days
- Targets: A11y bloggers, UX influencers, agency owners

---

## 12. Risks và mitigation

### Risk 1: Figma changes plugin policy
**Likelihood:** Medium. **Impact:** High.
**Mitigation:** Multi-surface strategy — không phụ thuộc 100% Figma. Có dashboard SaaS standalone.

### Risk 2: Big Tech (Figma/Adobe) ra free competitor
**Likelihood:** Medium. **Impact:** High.
**Mitigation:** Move fast on Enterprise tier (compliance reports họ không quan tâm). Lock in design partners với contracts dài.

### Risk 3: WCAG 3.0 launch và breaking spec change
**Likelihood:** Low (3-5 năm). **Impact:** Medium.
**Mitigation:** Active W3C participation. Beta access to draft spec.

### Risk 4: Lawsuit về claim "compliance"
**Likelihood:** Low. **Impact:** High.
**Mitigation:** Disclaimer "Desygn A11y assists with WCAG compliance review but does not guarantee legal compliance." Legal review của marketing copy.

### Risk 5: AI hallucination trong audit (false positive)
**Likelihood:** Medium. **Impact:** Medium.
**Mitigation:** AI suggestions chỉ là "nice to have". Core audit rule-based, deterministic. AI có toggle off.

---

## 13. North-star roadmap

**Year 1:** Land. Cement product-market fit ở Pro + Team. Earn first 20 enterprise references.

**Year 2:** Expand. Launch mobile audit. Launch white-label cho consultancies. Hit $5M ARR.

**Year 3:** Defend. Build moat with proprietary audit IP (custom WCAG framework, AI-trained on millions of audits). Hit $15M ARR.

**Exit options Year 3-5:**
- Strategic acquisition by Figma, Adobe, Atlassian (estimated valuation: 6× ARR = $90M)
- PE-led growth round (Series B equivalent)
- Continue as lifestyle business at 90% margin ($13M cashflow/năm)

Founder optionality > exit pressure. Build for revenue first.
