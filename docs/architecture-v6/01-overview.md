# Desygn A11y — Move 1 Implementation Brief

> **Mục đích:** Tài liệu này được viết để Claude Code triển khai Move 1 — Accessibility-as-a-Service (Desygn A11y) trong codebase `Design-md-ai` (v5.1.1). Đọc file này TRƯỚC, sau đó đọc theo thứ tự: `02-business-model.md` → `03-backend-architecture.md` → `04-frontend-architecture.md` → `05-web-template-redesign.md` → `06-performance.md` → `07-implementation-roadmap.md`.

---

## 0. Tại sao Move 1 là ưu tiên

### Vị thế hiện tại
Bạn đang sở hữu:
- `AccessibilityAgent.ts` (401 LOC) với 7 capabilities: contrast, touch target, ARIA, keyboard nav, focus indicator, heading hierarchy, reduced motion
- `SerializedNode` type đã có sẵn `contrastRatio`, `touchTargetCompliant`, `inferredRole`, `hasInteractions`, `responsiveBehavior`
- Plugin Figma scan engine đã production-ready
- Supabase schema đã có `audit_runs`, `checklist_results`, `evidence_artifacts`, `user_profiles_rbac`
- 22-agent fleet để chạy audit pipeline
- 109 test files, 1577 tests
- CSP + HSTS + auth crypto đã chuẩn

### Cơ hội thị trường
- EU Accessibility Act enforced từ 28/06/2025 — bắt buộc audit cho mọi product B2C trong EU
- ADA Title III lawsuits tại US tăng 14% YoY (2025: 4,605 cases riêng cho digital products)
- Section 508 (US federal) yêu cầu audit cho mọi tool có ngân sách công
- Compliance market size: $4.2B (2025), CAGR 13.4%
- **Pain point chưa được giải quyết tốt:** Audit *trước khi code*, không phải audit *production website*

### Đối thủ và khoảng trống
| Tool | Giai đoạn | WCAG depth | Figma integration | Pricing |
|---|---|---|---|---|
| axe DevTools | Production code | Sâu | Không | $39-499/dev/tháng |
| WAVE | Production code | Trung bình | Không | $1,500/site/năm |
| Stark | Design (Figma) | Nông (contrast + colorblind) | Có | $14-39/user/tháng |
| Figma A11y plugin | Design (Figma) | Cực nông | Có (built-in) | Free |
| **Desygn A11y (bạn)** | **Design + Code** | **Sâu (6 dimensions)** | **Native plugin + MCP + IDE** | **$29-2,999/tháng** |

**Khoảng trống bạn lấp:** Audit sâu (như axe) + sớm (như Stark) + tích hợp AI agent (chưa ai có).

---

## 1. Sản phẩm cốt lõi

### 1.1 Tagline
> *"Catch accessibility issues in Figma before they cost you $50,000 in lawsuits."*

### 1.2 Job-to-be-done
> *"As a [design system lead / compliance officer], I want to ensure every product shipped meets WCAG 2.2 AA, so that we avoid legal risk and serve users with disabilities."*

### 1.3 5 capabilities ship MVP

1. **Figma Audit** — Plugin scan toàn bộ file, xuất report PDF + JSON
2. **Dashboard SaaS** — Hosted version: upload file Figma URL → audit report online
3. **GitHub Action** — CI gate: PR có Figma link → audit → block merge nếu fail
4. **MCP Server** — Cursor/Claude Code/Windsurf gọi tool `audit_figma_for_a11y`
5. **PDF Compliance Report** — Có chữ ký Desygn AI, dùng được cho audit pháp lý

### 1.4 Out-of-scope cho MVP (NOT v1.0)

- ❌ Live website audit (đó là axe territory — đừng cạnh tranh)
- ❌ Auto-fix design (designer phải tự fix, mình chỉ report)
- ❌ Screen reader simulation (quá phức tạp, để v2)
- ❌ Multi-language report (EN only cho MVP, i18n sau)
- ❌ White-label / on-prem (Enterprise tier sau)

---

## 2. Đối tượng người dùng

### 2.1 Persona 1 — Compliance Officer "Sarah"
- Job: Đảm bảo công ty fintech tuân thủ EU Accessibility Act
- Pain: Audit cuối quý phát hiện ra 1,200 issues, không kịp fix
- Job to be done: Catch issues mỗi sprint, không đợi audit lớn
- Tier: **Enterprise ($2,999/tháng)**
- Volume: 1 Sarah per company × 5,000 mid+large companies EU/US = TAM 5,000

### 2.2 Persona 2 — Design System Lead "Alex"
- Job: Maintain design system cho team 30 designers
- Pain: Mỗi component shipped phải check a11y manual, không scale
- Job to be done: Auto-audit mỗi PR component thay đổi
- Tier: **Team ($299/tháng/seat 5+)**
- Volume: 50,000+ companies có design system team

### 2.3 Persona 3 — Indie Designer "Mai"
- Job: Freelance, làm Shopify themes
- Pain: Client yêu cầu báo cáo a11y nhưng không biết làm
- Job to be done: 1-click audit + PDF report bán kèm dịch vụ
- Tier: **Pro ($29/tháng)**
- Volume: 500,000+ freelance designers toàn cầu

### 2.4 Persona 4 — Indie Developer "Tom"
- Job: Build SaaS solo bằng Cursor/Claude Code
- Pain: Muốn ship product accessible nhưng không có time check WCAG
- Job to be done: AI agent tự audit khi viết code
- Tier: **Free + MCP** (acquisition funnel)
- Volume: 2,000,000+ indie devs toàn cầu

---

## 3. Tiêu chí thành công

### 3.1 North Star Metric
**Số lượng a11y issues caught per week across all customers.**

Lý do: Đây là metric phản ánh giá trị thực tế tạo ra. Mỗi issue caught early = $500 saved (cost of fixing post-launch theo nghiên cứu IBM). 100 issues/week = $50,000 customer value/week = pricing power bền vững.

### 3.2 Mục tiêu theo quý

| Quý | Pro users | Team customers | Enterprise | MRR | NPS |
|---|---|---|---|---|---|
| Q1 (M1-3) | 30 | 3 | 0 | $1,800 | n/a |
| Q2 (M4-6) | 150 | 15 | 2 | $13,500 | >40 |
| Q3 (M7-9) | 400 | 40 | 8 | $50,000 | >50 |
| Q4 (M10-12) | 800 | 100 | 20 | $130,000 | >55 |

ARR target năm 1: **$1.5M**. Conservative. Có thể overshoot nếu EU Act compliance push mạnh hơn dự kiến.

### 3.3 Leading indicators

- **Activation**: % user complete first audit trong 24h (target >60%)
- **Retention M1→M2**: % paid user còn active (target >85% Pro, >95% Team)
- **Expansion**: Average revenue per account growth (target +15%/quý)
- **CAC payback**: Tháng để recover acquisition cost (target <6 tháng cho Pro, <3 cho Team)

---

## 4. Vị thế thương hiệu

### 4.1 Brand promise
> *"The only accessibility platform that audits your design before you write a single line of code."*

### 4.2 Differentiation pillars
1. **Design-first**: Catch issues 10× cheaper than fixing post-launch
2. **AI-native**: Tích hợp với AI coding agents qua MCP — không cần workflow mới
3. **Legal-grade reports**: PDF có chữ ký, dùng được trong compliance audit
4. **Multi-surface**: Plugin + Dashboard + IDE Extension + CI — gặp user ở chỗ họ làm việc

### 4.3 Naming
- Product: **Desygn A11y** (sub-brand của Desygn AI)
- Domain đề xuất: `a11y.desygn.ai` (subdomain) hoặc `desygn-a11y.com` (standalone)
- Khuyến nghị: **subdomain** vì leverage brand authority của parent

---

## 5. Tóm tắt 6 file documents

| File | Mục đích | Mức độ kỹ thuật |
|---|---|---|
| `01-overview.md` (file này) | Brief tổng quan, persona, target | Business |
| `02-business-model.md` | Pricing tiers, monetization, sales funnel | Business + tech |
| `03-backend-architecture.md` | Database schema, API endpoints, queue, infra | Tech sâu |
| `04-frontend-architecture.md` | Dashboard SaaS structure, state mgmt, components | Tech sâu |
| `05-web-template-redesign.md` | Design system mới, layout, color tokens | Design + tech |
| `06-performance.md` | Caching, indexing, CDN, queries N+1, bundle | Tech sâu |
| `07-implementation-roadmap.md` | 12-week sprint plan với deliverables cụ thể | PM + tech |

---

## 6. Hard constraints cho Claude Code

Khi triển khai, các nguyên tắc bất biến:

1. **Không phá** plugin Figma hiện tại (`plugin/`). Plugin vẫn hoạt động standalone.
2. **Không phá** web workspace hiện tại (`web/src/`). Dashboard mới mount ở route khác.
3. **Reuse `AccessibilityAgent.ts`** — đừng viết lại. Wrap nó trong server-side runner.
4. **Reuse Supabase schema** — extend, không tạo DB mới.
5. **Tất cả tiền** đi qua Stripe — không tự xử lý PCI.
6. **Audit results** phải reproducible — cùng input → cùng output. Cache aggressively.
7. **WCAG version** phải explicit — mặc định 2.2 AA, support cả 2.1 AA, 2.2 AAA.
8. **Reports** phải digitally signed (PKI hoặc HMAC) để dùng pháp lý được.
9. **PII**: nếu user upload Figma có user data thật → redact trong report. Reuse `web/src/lib/piiDetection.ts`.
10. **Rate limit theo tier** — free 5 audit/tháng, Pro 100, Team 1000, Enterprise unlimited.

---

## 7. Cách dùng tài liệu này

**Claude Code workflow:**

1. Đọc cả 7 file theo thứ tự
2. Bắt đầu với `07-implementation-roadmap.md` Week 1 — không nhảy cóc
3. Mỗi sprint kết thúc, update CHANGELOG.md và viết ADR nếu có quyết định kiến trúc mới
4. Khi gặp ambiguity, default về **đơn giản nhất khả thi** — không over-engineer
5. Mỗi feature mới đi kèm: code + test + Storybook story + i18n keys + docs

**Confirm hiểu trước khi code:** Trước khi bắt đầu code Week 1, Claude Code nên viết 1-page summary lại scope hiểu được, để owner (Minh Đức) duyệt.
