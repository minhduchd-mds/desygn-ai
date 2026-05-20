# Hướng dẫn Open Source

Chào mừng bạn đến với **Desygn AI** — Design Intelligence Engine mã nguồn mở.

## Desygn AI là gì?

Desygn AI là Figma plugin và web workspace biến thiết kế thành code production-ready bằng AI multi-agent pipeline. Phiên bản v5 tích hợp hệ thống Agentic UI/UX Auditor tự học — 8 agent chuyên biệt đánh giá, sửa lỗi, và cải thiện thiết kế liên tục.

## Kiến trúc v5

### Figma Plugin Layer
- Figma sandbox (no DOM, no fetch) — chỉ Figma API
- Serializer v3: `inferredRole`, `touchTargetCompliant`, `contrastRatio`, `responsiveBehavior`
- Giao tiếp qua typed `PluginMessage` (postMessage)

### Web Application Layer
```
web/src/
├── ai-layer/           AI experiment orchestration
├── app-shell/          Toast, theme, global config
├── auth/               Session controller + TTL watchdog
├── chat-engine/        AI chat + provider abstraction
├── design-engine/      Design.md generation + validation
├── workspace-store/    Reactive state (useSyncExternalStore)
└── ux-checklist/       Agentic UI/UX Auditor v5
```

### Agent Pipeline
```
Figma Plugin ──scan──▶ DesignAuditAgent ──▶ ScoreAgent ──▶ RecommendAgent
                            │                    │               │
                            ▼                    ▼               ▼
                     AccessibilityAgent   DesignSystemAgent  FixPlannerAgent
                            │                    │               │
                            ▼                    ▼               ▼
                     IssueWriterAgent     MemoryAgent        CIGate
```

### Intelligence Layer
- **Shannon Engine** — Multi-agent orchestrator (6 agents)
- **GOAP Planner** — A* search cho optimal audit ordering
- **Evidence Memory** — HNSW vector search + sigmoid decay
- **PII Detection** — Vietnamese CCCD/CMND/phone, credit cards, SSN

### Self-Learning Loop
1. Agent đánh giá → `AuditResult`
2. ScoreAgent hiệu chỉnh Bayesian với historical evidence
3. LearningLoop lưu vào Evidence Memory (HNSW)
4. User feedback điều chỉnh trọng số criterion
5. Sigmoid decay trên evidence chưa validate
6. Audit tiếp theo dùng calibrated weights → chính xác hơn

## Bắt đầu

```bash
git clone https://github.com/minhduchd-mds/desygn-ai.git
cd desygn-ai
npm install
npm run dev        # Plugin + UI dev mode
npm run dev:web    # Web workspace
npm test           # 1192 tests / 69 files
```

## Đóng góp

- **Good First Issues**: Tìm label `good-first-issue`
- **Tài liệu**: Cải thiện guides, thêm ví dụ
- **Testing**: Viết tests cho modules chưa cover
- **Agent mới**: Implement interface từ `agents.ts`
- **Criteria mới**: Thêm vào `BUILT_IN_CRITERIA`
- **Bug Reports**: Tạo issue chi tiết với reproduction steps

## Cộng đồng

- GitHub Issues — Bug reports và feature requests
- GitHub Discussions — Câu hỏi và ý tưởng
- Pull Requests — Đóng góp code

## License

MIT License. Xem [LICENSE](./LICENSE) để biết chi tiết.
