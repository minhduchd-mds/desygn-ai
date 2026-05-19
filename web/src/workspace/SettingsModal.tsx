/**
 * SettingsModal — extracted from App() for code splitting and maintainability.
 * Receives all needed state via props; no internal state except `figmaMcpStatus`.
 */
import { useState, useCallback } from "react";
import type { SessionUser } from "../app/types";
import { testFigmaMcpConnection, type FigmaMcpStatus } from "./figmaMcpClient";

export type SettingsTab = "profile" | "appearance" | "behavior" | "notifications" | "extensions" | "document" | "other";

export interface IntegrationItem {
  id: string;
  name: string;
  icon: string;
  status: "connected" | "disconnected" | "soon";
  endpoint?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  // Profile
  user: SessionUser | null;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onUpgradePro: () => void;
  // Appearance
  chatTheme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  // Behavior
  groqModel: string;
  onModelChange: (model: string) => void;
  // Extensions
  integrations: IntegrationItem[];
  onSaveIntegrations: (items: IntegrationItem[]) => void;
  figmaMcpEndpoint: string;
  onFigmaMcpEndpointChange: (ep: string) => void;
  chatMappingEnabled: boolean;
  onChatMappingChange: (v: boolean) => void;
  // Other
  shareLinksEnabled: boolean;
  onShareLinksChange: (v: boolean) => void;
  onClearHistory: () => void;
  onShowToast: (msg: string, type: "success" | "error" | "warn" | "info") => void;
  // Generate Design.md reset
  onResetMessages: () => void;
}

const SETTINGS_TABS = [
  { id: "profile" as const,       icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",                                                                                          label: "Profile" },
  { id: "appearance" as const,    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z", label: "Giao diện" },
  { id: "behavior" as const,      icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",                                                                                                  label: "Hành vi" },
  { id: "notifications" as const, icon: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",                                                               label: "Thông báo" },
  { id: "extensions" as const,    icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z",                                                                             label: "Extensions" },
  { id: "document" as const,      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",           label: "Tài liệu" },
  { id: "other" as const,         icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4", label: "Cài đặt khác" },
] as const;

export function SettingsModal({
  isOpen, onClose, tab, onTabChange,
  user, displayName, onDisplayNameChange, onUpgradePro,
  chatTheme, onThemeChange,
  groqModel, onModelChange,
  integrations, onSaveIntegrations, figmaMcpEndpoint, onFigmaMcpEndpointChange,
  chatMappingEnabled, onChatMappingChange,
  shareLinksEnabled, onShareLinksChange,
  onClearHistory, onShowToast,
}: SettingsModalProps) {
  // Figma MCP live connection status — keyed by endpoint so it resets when URL changes
  const [mcpState, setMcpState] = useState<{ endpoint: string; status: FigmaMcpStatus }>({ endpoint: figmaMcpEndpoint, status: "idle" });
  const mcpStatus = mcpState.endpoint === figmaMcpEndpoint ? mcpState.status : "idle";
  const setMcpStatus = useCallback((status: FigmaMcpStatus) => setMcpState({ endpoint: figmaMcpEndpoint, status }), [figmaMcpEndpoint]);

  const figmaIntegration = integrations.find(i => i.id === "figma-mcp");

  const handleFigmaConnect = useCallback(async () => {
    if (!figmaMcpEndpoint.trim()) { onShowToast("Nhập MCP endpoint URL", "warn"); return; }
    setMcpStatus("connecting");
    localStorage.setItem("designready.figma-mcp-endpoint", figmaMcpEndpoint);
    const result = await testFigmaMcpConnection(figmaMcpEndpoint);
    setMcpStatus(result);
    if (result === "connected") {
      const next = integrations.map(i => i.id === "figma-mcp" ? { ...i, status: "connected" as const, endpoint: figmaMcpEndpoint } : i);
      onSaveIntegrations(next);
      onShowToast("✓ Kết nối Figma MCP thành công!", "success");
    } else {
      onShowToast("Không thể kết nối. Kiểm tra endpoint và Figma MCP server.", "error");
    }
  }, [figmaMcpEndpoint, integrations, onSaveIntegrations, onShowToast, setMcpStatus]);

  const handleFigmaDisconnect = useCallback(() => {
    const next = integrations.map(i => i.id === "figma-mcp" ? { ...i, status: "disconnected" as const, endpoint: undefined } : i);
    onSaveIntegrations(next);
    onFigmaMcpEndpointChange("");
    localStorage.removeItem("designready.figma-mcp-endpoint");
    setMcpStatus("idle");
    onShowToast("Đã ngắt kết nối Figma MCP", "info");
  }, [integrations, onSaveIntegrations, onFigmaMcpEndpointChange, onShowToast, setMcpStatus]);

  if (!isOpen) return null;

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-modal-header">
          <h2>Cài đặt</h2>
          <button type="button" className="settings-close-btn" aria-label="Đóng cài đặt" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Tab nav */}
          <nav className="settings-tabs" aria-label="Settings navigation">
            {SETTINGS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`settings-tab-btn${tab === t.id ? " active" : ""}`}
                onClick={() => onTabChange(t.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                  {t.id === "profile" && <circle cx="12" cy="7" r="4" />}
                </svg>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="settings-content" role="tabpanel">
            {/* ── Profile ── */}
            {tab === "profile" && (
              <div className="settings-section">
                <h3>Profile</h3>
                <label className="settings-field">
                  <span>Tên hiển thị</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => onDisplayNameChange(e.target.value)}
                    placeholder={user?.displayEmail?.split("@")[0] || "User"}
                    autoComplete="name"
                  />
                </label>
                <label className="settings-field">
                  <span>Email</span>
                  <input type="text" value={user?.displayEmail ?? ""} disabled aria-readonly="true" />
                </label>
                <label className="settings-field">
                  <span>Gói dịch vụ</span>
                  <div className="settings-plan-row">
                    <span className={`plan-badge plan-${user?.plan}`}>{user?.plan === "pro" ? "Pro" : "Free"}</span>
                    {user?.plan !== "pro" && (
                      <button type="button" className="settings-upgrade-btn" onClick={onUpgradePro}>
                        Nâng cấp Pro
                      </button>
                    )}
                  </div>
                </label>
              </div>
            )}

            {/* ── Appearance ── */}
            {tab === "appearance" && (
              <div className="settings-section">
                <h3>Giao diện</h3>
                <label className="settings-field">
                  <span>Theme</span>
                  <select value={chatTheme} onChange={(e) => onThemeChange(e.target.value as "dark" | "light")}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Ngôn ngữ</span>
                  <select defaultValue="vi">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
            )}

            {/* ── Behavior ── */}
            {tab === "behavior" && (
              <div className="settings-section">
                <h3>Hành vi</h3>
                <label className="settings-field">
                  <span>Enter để gửi tin nhắn</span>
                  <span className="settings-hint">Nhấn Enter gửi, Shift+Enter xuống dòng</span>
                  <select defaultValue="enter">
                    <option value="enter">Enter gửi tin</option>
                    <option value="shift">Shift+Enter gửi tin</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>AI Model mặc định</span>
                  <select value={groqModel} onChange={(e) => { onModelChange(e.target.value); localStorage.setItem("designready.model", e.target.value); }}>
                    <optgroup label="Groq (ultra-fast)">
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B (default)</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B (fast)</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B (32K ctx)</option>
                      <option value="gemma2-9b-it">Gemma 2 9B</option>
                    </optgroup>
                    <optgroup label="Google Gemini (multimodal)">
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (best)</option>
                      <option value="gemini-2.0-flash-lite">Gemini 2.0 Lite (fastest)</option>
                    </optgroup>
                  </select>
                </label>
              </div>
            )}

            {/* ── Notifications ── */}
            {tab === "notifications" && (
              <div className="settings-section">
                <h3>Thông báo</h3>
                <label className="settings-toggle-row">
                  <div>
                    <span>Thông báo hoàn thành</span>
                    <span className="settings-hint">Nhận thông báo khi AI hoàn thành tạo Design.md</span>
                  </div>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="settings-toggle-row">
                  <div>
                    <span>Âm thanh thông báo</span>
                    <span className="settings-hint">Phát âm thanh khi có thông báo mới</span>
                  </div>
                  <input type="checkbox" />
                </label>
              </div>
            )}

            {/* ── Extensions ── */}
            {tab === "extensions" && (
              <div className="settings-section">
                <h3>Extensions &amp; Integrations</h3>
                <p className="settings-section-desc">Kết nối Desygn AI với các công cụ thiết kế và phát triển bên ngoài.</p>

                <div className="ext-grid">
                  {/* Figma MCP */}
                  <div className={`ext-card${figmaIntegration?.status === "connected" ? " connected" : ""}`}>
                    <div className="ext-card-header">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M5 5.5A3.5 3.5 0 018.5 2H12v7H8.5A3.5 3.5 0 015 5.5z" fill="#F24E1E"/>
                        <path d="M12 2h3.5a3.5 3.5 0 010 7H12V2z" fill="#FF7262"/>
                        <path d="M12 9.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z" fill="#1ABCFE"/>
                        <path d="M5 16.5A3.5 3.5 0 018.5 13H12v3.5a3.5 3.5 0 01-7 0z" fill="#0ACF83"/>
                        <path d="M5 9.5A3.5 3.5 0 018.5 6H12v7H8.5A3.5 3.5 0 015 9.5z" fill="#A259FF"/>
                      </svg>
                      <div className="ext-card-info">
                        <strong>Figma MCP</strong>
                        <span className="ext-card-desc">Kết nối trực tiếp qua Model Context Protocol — đọc design tokens, components, variables từ Figma</span>
                      </div>
                      <span className={`ext-status ext-status-${figmaIntegration?.status ?? "disconnected"}`}>
                        {mcpStatus === "connecting" ? "Đang kết nối…" :
                         figmaIntegration?.status === "connected" ? "Đã kết nối" : "Chưa kết nối"}
                      </span>
                    </div>
                    <div className="ext-card-body">
                      <label className="settings-field">
                        <span>MCP Endpoint URL</span>
                        <input
                          type="url"
                          value={figmaMcpEndpoint}
                          onChange={(e) => onFigmaMcpEndpointChange(e.target.value)}
                          placeholder="ws://localhost:3333/figma-mcp"
                          aria-label="Figma MCP endpoint URL"
                        />
                      </label>
                      {mcpStatus === "error" && (
                        <p className="ext-error-msg">
                          ✗ Không thể kết nối. Đảm bảo Figma MCP server đang chạy tại endpoint trên.
                        </p>
                      )}
                      {figmaIntegration?.endpoint && figmaIntegration.status === "connected" && (
                        <p className="ext-connected-msg">✓ Connected: {figmaIntegration.endpoint}</p>
                      )}
                      <div className="ext-card-actions">
                        <button
                          type="button"
                          className="ext-connect-btn"
                          disabled={mcpStatus === "connecting"}
                          onClick={() => void handleFigmaConnect()}
                        >
                          {mcpStatus === "connecting" ? "Đang kết nối…" :
                           figmaIntegration?.status === "connected" ? "Kiểm tra lại" : "Kết nối"}
                        </button>
                        {figmaIntegration?.status === "connected" && (
                          <button type="button" className="ext-disconnect-btn" onClick={handleFigmaDisconnect}>
                            Ngắt kết nối
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* GitHub */}
                  <ExtSoonCard
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>}
                    name="GitHub"
                    desc="Đồng bộ repo, auto-push Design.md, review PR tự động"
                    roadmapNote="OAuth flow + Octokit API — Q3 2025"
                  />

                  {/* Vercel */}
                  <ExtSoonCard
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19.5h20L12 2z"/></svg>}
                    name="Vercel Deploy"
                    desc="Deploy preview trực tiếp từ Design.md output qua Vercel API"
                    roadmapNote="Vercel API token + project ID — Q3 2025"
                  />

                  {/* Notion */}
                  <ExtSoonCard
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.19 2.15c-.467-.373-.98-.56-2.055-.466l-12.8.793c-.467.047-.56.28-.373.466l1.497 1.265zm.793 2.89v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.166V6.143c0-.606-.233-.933-.746-.886l-15.177.84c-.56.047-.747.327-.747.887zm14.337.466c.094.42 0 .84-.42.886l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.187c-.094-.187 0-.653.327-.746l.84-.233V8.558l-1.168-.094c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279V8.09l-1.215-.14c-.093-.513.28-.886.747-.933l3.222-.187z"/></svg>}
                    name="Notion"
                    desc="Sync BA documents & project specs sang Notion workspace"
                    roadmapNote="Notion API + OAuth — Q4 2025"
                  />

                  {/* Linear */}
                  <ExtSoonCard
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3.357 16.643a.75.75 0 01-.066-1.002l7.006-8.674a.75.75 0 011.174.004l3.076 3.873 3.933-4.87a.75.75 0 011.174.003l2.003 2.523a.75.75 0 01-.588.977H3.93z"/></svg>}
                    name="Linear"
                    desc="Tạo issues từ Design.md checklist, track design debt tự động"
                    roadmapNote="Linear API + Personal API key — Q4 2025"
                  />
                </div>

                <div className="settings-divider" />

                {/* Advanced connection — MCP fallback guidance */}
                <h4 className="settings-subsection-title">Kết nối chuyên sâu</h4>
                <p className="settings-section-desc">
                  Cấu hình kết nối nâng cao cho tích hợp code và design pipeline.
                </p>

                <div className="ext-card" style={{ marginBottom: 16 }}>
                  <div className="ext-card-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                    <div className="ext-card-info">
                      <strong>MCP Protocol</strong>
                      <span className="ext-card-desc">
                        Model Context Protocol cho phép AI đọc trực tiếp context từ Figma, GitHub, Vercel.
                        {figmaIntegration?.status !== "connected" && (
                          <> Chưa có MCP server? Desygn AI vẫn hoạt động đầy đủ — MCP chỉ bổ sung thêm context tự động.</>
                        )}
                      </span>
                    </div>
                    <span className={`ext-status ${figmaIntegration?.status === "connected" ? "ext-status-connected" : "ext-status-disconnected"}`}>
                      {figmaIntegration?.status === "connected" ? "Active" : "Offline"}
                    </span>
                  </div>
                  {figmaIntegration?.status !== "connected" && (
                    <div className="ext-card-body">
                      <div className="mcp-fallback-guide">
                        <p className="settings-hint" style={{ marginBottom: 8 }}>
                          <strong style={{ color: "#e2e8f0" }}>Không có MCP?</strong> Bạn vẫn có thể:
                        </p>
                        <ul className="doc-list" style={{ marginBottom: 12 }}>
                          <li>Upload file Figma (.fig) hoặc ảnh thiết kế trực tiếp vào chat</li>
                          <li>Dán design tokens (JSON) vào prompt để AI phân tích</li>
                          <li>Sử dụng Templates (73 mẫu) để tạo Design.md không cần Figma</li>
                          <li>Export manual từ Figma: Inspect panel &rarr; copy CSS/tokens</li>
                        </ul>
                        <p className="settings-hint">
                          Để bật MCP: cài <code style={{ fontSize: 11, padding: "1px 4px", background: "rgba(139,92,246,0.1)", borderRadius: 4, color: "#a78bfa" }}>@anthropic/figma-mcp</code> và nhập endpoint URL ở mục Figma MCP phía trên.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <h4 className="settings-subsection-title">Chat Flow Mapping</h4>
                <p className="settings-section-desc">Khi bật, kết quả chat có thể được forward sang các kênh tích hợp đã kết nối.</p>
                <label className="settings-toggle-row">
                  <div>
                    <span>Bật Chat Mapping</span>
                    <span className="settings-hint">Forward output sang Figma / GitHub Issues / Notion</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatMappingEnabled}
                    onChange={(e) => { onChatMappingChange(e.target.checked); localStorage.setItem("designready.chat-mapping", String(e.target.checked)); }}
                  />
                </label>

                <h4 className="settings-subsection-title">Code Integration</h4>
                <p className="settings-section-desc">Tích hợp output vào codebase — export Design.md trực tiếp sang project.</p>
                <label className="settings-toggle-row">
                  <div>
                    <span>Auto-export Design.md</span>
                    <span className="settings-hint">Tự động lưu Design.md vào clipboard hoặc file khi generate xong</span>
                  </div>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="settings-toggle-row">
                  <div>
                    <span>Include AI context in export</span>
                    <span className="settings-hint">Đính kèm chat context + design tokens khi export cho AI coding agents</span>
                  </div>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>
            )}

            {/* ── Document ── */}
            {tab === "document" && (
              <div className="settings-section">
                <h3>Tài liệu phần mềm</h3>
                <p className="settings-section-desc">Kiến trúc hệ thống, tính năng, API reference và keyboard shortcuts của Desygn AI.</p>

                <div className="doc-section">
                  <h4>Tổng quan</h4>
                  <p>Desygn AI là công cụ chuyển đổi Figma → Design.md cho AI coding agents (Codex, Claude Code, Cursor, Windsurf). Gồm 3 module chính:</p>
                  <ul className="doc-list">
                    <li><strong>Figma Plugin</strong> — Scan components, score AI-readiness (0-100), export tokens, BA docs</li>
                    <li><strong>Web Workspace</strong> — Chat AI (Groq), generate Design.md, 73 templates, compare panel</li>
                    <li><strong>API Layer</strong> — Serverless: chat, HTML gen, image analysis, screen generation</li>
                  </ul>
                </div>

                <div className="doc-section">
                  <h4>Kiến trúc</h4>
                  <div className="doc-arch-diagram">
                    <div className="doc-arch-box"><span className="doc-arch-label">Plugin Sandbox</span><small>Figma API only • No DOM</small></div>
                    <span className="doc-arch-arrow">⇄ postMsg</span>
                    <div className="doc-arch-box"><span className="doc-arch-label">UI Iframe</span><small>React • CSS Modules</small></div>
                    <span className="doc-arch-arrow">→ fetch</span>
                    <div className="doc-arch-box"><span className="doc-arch-label">API (Serverless)</span><small>Vercel • Groq • Supabase</small></div>
                  </div>
                </div>

                <div className="doc-section">
                  <h4>Tính năng chính</h4>
                  <div className="doc-features-grid">
                    {[
                      { icon: "🎨", title: "73 Design Templates", desc: "Lazy-loaded, category filtering, auto-match" },
                      { icon: "🤖", title: "AI Chat (Groq)", desc: "Llama 3.3 70B, streaming, markdown" },
                      { icon: "📊", title: "AI Readiness Score", desc: "7-category evaluation (0-100)" },
                      { icon: "🔍", title: "Compare Panel", desc: "Design vs Code + bug markers" },
                      { icon: "📱", title: "Responsive Detection", desc: "Mobile/Tablet/Desktop variants" },
                      { icon: "🔗", title: "Extensions (MCP)", desc: "Figma, GitHub, Vercel integrations" },
                    ].map(f => (
                      <div key={f.title} className="doc-feature-card">
                        <span className="doc-feature-icon">{f.icon}</span>
                        <strong>{f.title}</strong>
                        <small>{f.desc}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="doc-section">
                  <h4>API Endpoints</h4>
                  <table className="doc-api-table">
                    <thead><tr><th>Route</th><th>Method</th><th>Mô tả</th></tr></thead>
                    <tbody>
                      {[
                        ["/api/chat", "POST", "Groq AI chat — streaming response"],
                        ["/api/generate-html", "POST", "Generate HTML từ text prompt"],
                        ["/api/generate-screens", "POST", "Generate screen layouts"],
                        ["/api/analyze-image", "POST", "Phân tích ảnh thiết kế"],
                      ].map(([route, method, desc]) => (
                        <tr key={route}><td><code>{route}</code></td><td>{method}</td><td>{desc}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="doc-section">
                  <h4>Keyboard Shortcuts</h4>
                  <div className="doc-shortcuts">
                    {[
                      ["Enter", "Gửi tin nhắn"],
                      ["Shift + Enter", "Xuống dòng"],
                      ["Escape", "Đóng modal / popup"],
                      ["Ctrl + K", "Tìm kiếm template"],
                    ].map(([key, desc]) => (
                      <div key={key} className="doc-shortcut-row"><kbd>{key}</kbd><span>{desc}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Other ── */}
            {tab === "other" && (
              <div className="settings-section">
                <h3>Cài đặt khác</h3>
                <label className="settings-toggle-row">
                  <div>
                    <span>Cho phép chia sẻ link cuộc trò chuyện</span>
                    <span className="settings-hint">Tạo link chia sẻ với người khác</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={shareLinksEnabled}
                    onChange={(e) => { onShareLinksChange(e.target.checked); localStorage.setItem("designready.share-links", String(e.target.checked)); }}
                  />
                </label>
                <div className="settings-divider" />
                <div className="settings-field">
                  <span>Xóa bộ nhớ đệm</span>
                  <span className="settings-hint">Xóa dữ liệu cache, template đã tải, và các file tạm</span>
                  <button type="button" className="settings-danger-btn" onClick={() => onShowToast("Đã xóa bộ nhớ đệm", "success")}>
                    Xóa cache
                  </button>
                </div>
                <div className="settings-field">
                  <span>Xóa toàn bộ lịch sử</span>
                  <span className="settings-hint">Xóa tất cả lịch sử chat và dự án. Không thể hoàn tác.</span>
                  <button type="button" className="settings-danger-btn" onClick={onClearHistory}>
                    Xóa lịch sử
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper: "coming soon" integration card ─────────────────
function ExtSoonCard({ icon, name, desc, roadmapNote }: { icon: React.ReactNode; name: string; desc: string; roadmapNote?: string }) {
  return (
    <div className="ext-card ext-card-soon">
      <div className="ext-card-header">
        {icon}
        <div className="ext-card-info">
          <strong>{name}</strong>
          <span className="ext-card-desc">{desc}</span>
          {roadmapNote && <span className="ext-roadmap-note">📍 {roadmapNote}</span>}
        </div>
        <span className="ext-status ext-status-soon">Sắp ra mắt</span>
      </div>
    </div>
  );
}
