# Hướng dẫn đóng góp (Contributing)

Cảm ơn bạn đã quan tâm đến Desygn AI! Hướng dẫn này giúp bạn bắt đầu đóng góp.

## Yêu cầu

- Node.js 20+
- npm 10+
- Git

## Bắt đầu

### Option A: GitHub Codespaces (nhanh nhất)
Click **"Code" > "Codespaces" > "Create codespace"** trên GitHub — tự cài tất cả.

### Option B: Local setup

```bash
git clone https://github.com/minhduchd-mds/desygn-ai.git
cd desygn-ai
npm install
npm run dev        # Watch mode (UI + plugin)
npm run dev:web    # Web workspace dev server
```

### Option C: Full stack (with Supabase)

```bash
git clone https://github.com/minhduchd-mds/desygn-ai.git
cd desygn-ai
npm install
chmod +x scripts/setup-local-db.sh
./scripts/setup-local-db.sh    # Docker + Supabase + migrations + seed data
npm run dev:web
```

### First contribution?
Browse issues tagged [`good-first-issue`](https://github.com/minhduchd-mds/desygn-ai/labels/good-first-issue) or check `docs/good-first-issues/` for detailed specs.

## Cấu trúc dự án

```
plugin/              Figma sandbox (no DOM, no fetch). Chỉ Figma API.
ui/                  React iframe (no figma.*). Chỉ parent.postMessage.
shared/              Shared types (PluginMessage, SerializedNode) + utilities
web/src/
├── ai-layer/        AI experiment orchestration (multi-model, A/B testing)
├── app-shell/       Toast, theme, global config
├── auth/            Session controller + TTL watchdog
├── chat-engine/     AI chat với provider abstraction
├── design-engine/   Design.md generation + validation
├── workspace-store/ Reactive state (useSyncExternalStore)
├── ux-checklist/    Agentic UI/UX Auditor v5
│   ├── index.ts       Orchestrator + CriteriaRegistry + LearningLoop
│   ├── agents.ts      5 specialized agents
│   ├── github.ts      GitHub Issue/PR bridge
│   ├── stream.ts      Real-time audit streaming + React hook
│   ├── memory.ts      Cross-project learning + persistence
│   └── ci.ts          CI gate + SARIF + Deploy gate
└── lib/
    ├── shannonEngine.ts    Multi-agent orchestrator
    ├── evidenceMemory.ts   HNSW vector search + sigmoid decay
    ├── goapPlanner.ts      Goal-Oriented Action Planning (A*)
    └── designAnalyzer.ts   WCAG scoring + design debt
```

## Lệnh phát triển

| Lệnh | Mô tả |
|-------|--------|
| `npm run dev` | Watch mode (UI + plugin) |
| `npm run dev:web` | Web workspace dev server |
| `npm run build` | Production build → dist/ |
| `npm test` | Chạy 1313 tests (Vitest) |
| `npm run lint` | ESLint 9 |

## Quy ước đặt tên nhánh

- `feat/mo-ta-ngan` — Tính năng mới
- `fix/mo-ta-ngan` — Sửa lỗi
- `docs/mo-ta-ngan` — Tài liệu
- `refactor/mo-ta-ngan` — Tái cấu trúc code

## Quy ước commit

Sử dụng conventional commits:

```
feat: add mobile viewport analysis
fix: resolve SCSS variable undefined error
docs: update architecture diagram
refactor: extract ComparePanel from main.tsx
test: add Shannon engine unit tests
```

## Quy tắc code

### Bắt buộc
- TypeScript strict mode
- CSS Modules (`.module.scss`) cho component styles
- Dark theme only, gap-based layout
- Không gọi Figma API trong loops — batch tất cả
- Không dùng `findAll()` — dùng `findAllWithCriteria()` trên `currentPage`
- Scoring modules: pure functions, không side effects, không Figma API
- Sanitize prompt text qua `sanitize.ts` (phòng chống injection)
- Serializer: kiểm tra `isMixed()` trước khi đọc mixed properties. Max depth 15

### Agent System
- Thêm serializer field mới: `types.ts` → `serializer.ts` → `prompt-compact.ts`
- Agent mới: implement interface từ `agents.ts`, đăng ký trong `index.ts`
- Criteria mới: thêm vào `BUILT_IN_CRITERIA` trong `index.ts`
- Evidence Memory: luôn gọi `configure()` trước `storeEvidence()`

## Testing

Tất cả tính năng mới phải có tests:

```bash
npm test              # Chạy tất cả tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Hiện tại: **1192 tests** trên **69 files** — đảm bảo không regression.

## Quy trình Pull Request

1. Fork repository
2. Tạo feature branch từ `main`
3. Viết code + tests
4. Đảm bảo `npm test` và `npm run lint` pass
5. Submit PR với mô tả rõ ràng
6. Chờ review

## Kiến trúc Agent Pipeline

```
Figma Plugin ──scan──▶ DesignAuditAgent ──▶ ScoreAgent ──▶ RecommendAgent
                            │                    │               │
                            ▼                    ▼               ▼
                     AccessibilityAgent   DesignSystemAgent  FixPlannerAgent
                            │                    │               │
                            ▼                    ▼               ▼
                     IssueWriterAgent     MemoryAgent        CIGate
```

### Self-Learning Loop
1. Agent đánh giá criterion → `AuditResult`
2. `ScoreAgent` hiệu chỉnh với Bayesian historical evidence
3. `LearningLoop` lưu vào Evidence Memory (HNSW)
4. User feedback (agree/disagree/irrelevant) điều chỉnh trọng số
5. Sigmoid decay trên evidence chưa validate
6. Audit tiếp theo dùng calibrated weights → điểm chính xác hơn

## Câu hỏi?

Mở GitHub Discussion hoặc Issue để được hỗ trợ.
