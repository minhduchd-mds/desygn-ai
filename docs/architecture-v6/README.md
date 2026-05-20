# Desygn A11y — Move 1 Implementation Brief

> **Cho Claude Code:** Đây là bộ tài liệu đầy đủ để triển khai Move 1 (Accessibility-as-a-Service) cho repo `Design-md-ai`. Đọc theo đúng thứ tự dưới đây, KHÔNG nhảy cóc.

## Tài liệu (đọc theo thứ tự)

| # | File | Khi nào đọc | Tóm tắt |
|---|---|---|---|
| 1 | [`01-overview.md`](./01-overview.md) | Đầu tiên | Brief, persona, target, hard constraints |
| 2 | [`02-business-model.md`](./02-business-model.md) | Sau #1 | Pricing 4 tiers, TAM, sales funnel, unit economics |
| 3 | [`03-backend-architecture.md`](./03-backend-architecture.md) | Khi build backend | DB schema, API endpoints, Inngest queue, Stripe, MCP |
| 4 | [`04-frontend-architecture.md`](./04-frontend-architecture.md) | Khi build frontend | Tech stack, routes, components, state mgmt |
| 5 | [`05-web-template-redesign.md`](./05-web-template-redesign.md) | Khi build UI | Color tokens (OKLCH), typography, layouts, motion |
| 6 | [`06-performance.md`](./06-performance.md) | Throughout | Performance budgets, caching, optimization |
| 7 | [`07-implementation-roadmap.md`](./07-implementation-roadmap.md) | Khi bắt đầu code | 12-week plan với task list |

## Quick start cho Claude Code

```bash
# 1. Đọc tất cả 7 files (theo thứ tự)
# 2. Đọc CODEBASE_REVIEW.md ở folder parent
# 3. Write 1-page summary, gửi Minh Đức duyệt
# 4. Bắt đầu Week 0 trong 07-implementation-roadmap.md
```

## Hard constraints (KHÔNG được phá)

1. Plugin Figma hiện tại (`plugin/`) phải tiếp tục chạy
2. Web workspace hiện tại (`web/src/`) phải tiếp tục chạy
3. Reuse `AccessibilityAgent.ts` — đừng viết lại
4. Reuse Supabase schema — extend, không tạo DB mới
5. Tất cả tiền qua Stripe — không tự xử lý PCI
6. Audit results phải reproducible + cacheable
7. PDF reports phải digitally signed (dùng pháp lý được)
8. PII redaction qua `web/src/lib/piiDetection.ts`
9. Rate limit theo tier (Free 5, Pro 100, Team 1000, Enterprise ∞)
10. Mark P-level (P0-P4) trên mọi task

## Khi gặp ambiguity

KHÔNG tự quyết. Stop và hỏi Minh Đức trong Vietnamese. Default về **simplest viable** nếu không thể hỏi.

## Communication

- Owner: Minh Đức ([ducdmd00410@fpt.edu.vn](mailto:ducdmd00410@fpt.edu.vn))
- Repo: `github.com/minhduchd-mds/Design-md-ai`
- Live (current): `design-md-ai-yd6r.vercel.app`
- Target (Move 1): `a11y.desygn.ai` (or `desygn-a11y.com`)

## Tổng số dòng documents: ~5,000

Đủ context để Claude Code triển khai từ Week 0 đến launch (16 tuần).
