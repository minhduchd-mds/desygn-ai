import { useCallback, useRef, useState } from "react";
import { useMemo } from "react";
import { DESIGN_MD_TEMPLATES } from "../design/templateRegistry";
import type { ChatAttachment, OpenDesignDefinition, OpenDesignPreset, ProjectRequest, SetProjectRequest } from "../app/types";

type ComposerDropdown = "tools" | "category" | "design" | "model" | null;

const PROJECT_CATEGORIES = ["SaaS", "AI tool", "E-commerce", "Landing page", "Dashboard"];

const AI_MODELS: { value: string; label: string; desc: string }[] = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", desc: "Default" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B", desc: "Fast" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B", desc: "32K context" },
  { value: "gemma2-9b-it", label: "Gemma 2 9B", desc: "Compact" },
];

/** Convert a File to a ChatAttachment with data URL. */
function fileToAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: `att-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: file.type,
        name: file.name,
        url: reader.result as string,
        size: file.size,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface ChatComposerProps {
  isGenerating: boolean;
  openDesignPresets: Record<OpenDesignPreset, OpenDesignDefinition>;
  request: ProjectRequest;
  selectedPreset: OpenDesignDefinition;
  setRequest: SetProjectRequest;
  workspaceTab: "chat" | "code" | "checklist";
  groqModel: string;
  onModelChange: (model: string) => void;
  onSendChat: (attachments?: ChatAttachment[]) => void;
  onGenerateDesignMd: () => void;
  onCreateImage: () => void;
  onUploadMarkdownFiles: (files: FileList) => void;
  onUploadScreenshot: (files: FileList) => void;
}

export function ChatComposer({
  isGenerating,
  openDesignPresets,
  request,
  selectedPreset,
  setRequest,
  workspaceTab,
  groqModel,
  onModelChange,
  onSendChat,
  onGenerateDesignMd,
  onCreateImage,
  onUploadMarkdownFiles,
  onUploadScreenshot,
}: ChatComposerProps) {
  const [composerDropdown, setComposerDropdown] = useState<ComposerDropdown>(null);
  const [designQuery, setDesignQuery] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);

  // Add files as attachments
  const addAttachments = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.size <= MAX_FILE_SIZE);
    const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
    if (remaining <= 0) return;
    const toProcess = fileArr.slice(0, remaining);
    const newAtts = await Promise.all(toProcess.map(fileToAttachment));
    setPendingAttachments((prev) => [...prev, ...newAtts]);
  }, [pendingAttachments.length]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const templateMetaById = useMemo(() => new Map(DESIGN_MD_TEMPLATES.map((template) => [template.id, template])), []);
  const designEntries = useMemo(() => {
    const query = designQuery.trim().toLowerCase();
    return Object.entries(openDesignPresets).filter(([id, preset]) => {
      if (!query) return true;
      const meta = templateMetaById.get(id);
      return `${id} ${preset.label} ${preset.direction} ${meta?.category ?? ""} ${meta?.priority ?? ""} ${meta?.keywords.join(" ") ?? ""}`.toLowerCase().includes(query);
    });
  }, [designQuery, openDesignPresets, templateMetaById]);

  return (
    <form
      className={`chat-composer ${isGenerating ? "is-generating" : ""}${isDragOver ? " drag-over" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const atts = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
        setPendingAttachments([]);
        onSendChat(atts);
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length) void addAttachments(e.dataTransfer.files);
      }}
    >
      <div className="composer-box">
        {/* Hidden image input for chat attachments */}
        <input
          ref={chatImageInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(event) => {
            if (event.currentTarget.files?.length) void addAttachments(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept=".md,.markdown,.txt,.zip,application/zip"
          multiple
          hidden
          onChange={(event) => {
            if (event.currentTarget.files?.length) {
              onUploadMarkdownFiles(event.currentTarget.files);
            }
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={screenshotInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            if (event.currentTarget.files?.length) {
              onUploadScreenshot(event.currentTarget.files);
            } else {
              onCreateImage();
            }
            event.currentTarget.value = "";
          }}
        />
        <div className="composer-input-row">
          <textarea
            value={request.prompt}
            onChange={(event) => {
              setRequest({ ...request, prompt: event.target.value });
              const el = event.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const atts = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
                setPendingAttachments([]);
                onSendChat(atts);
                const el = event.target as HTMLTextAreaElement;
                requestAnimationFrame(() => {
                  el.style.height = "auto";
                });
              }
            }}
            onPaste={(event) => {
              const items = event.clipboardData?.items;
              if (!items) return;
              const imageFiles: File[] = [];
              for (const item of items) {
                if (item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))) {
                  const file = item.getAsFile();
                  if (file) imageFiles.push(file);
                }
              }
              if (imageFiles.length > 0) {
                event.preventDefault();
                void addAttachments(imageFiles);
              }
            }}
            placeholder={
              workspaceTab === "chat"
                ? "Nhắn tin cho Trợ lý ảo..."
                : "Hãy mô tả nhiệm vụ thiết kế của bạn hoặc dán ghi chú của chuyên viên phân tích nghiệp vụ..."
            }
            rows={1}
            style={{ overflow: "hidden", resize: "none" }}
          />
        </div>
        {/* Attachment preview strip */}
        {pendingAttachments.length > 0 && (
          <div className="composer-attachments">
            {pendingAttachments.map((att) => (
              <div key={att.id} className="composer-attachment-thumb">
                {att.type.startsWith("image/") ? (
                  <img src={att.url} alt={att.name} />
                ) : att.type.startsWith("video/") ? (
                  <video src={att.url} muted />
                ) : (
                  <span className="attachment-file-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </span>
                )}
                <button type="button" className="attachment-remove" onClick={() => removeAttachment(att.id)} aria-label="Remove">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="composer-bottom-row">
          <div className="composer-controls">
            <div className="composer-dropdown tool-dropdown">
              <button
                className="composer-icon"
                type="button"
                aria-label="Open tools"
                aria-haspopup="menu"
                aria-expanded={composerDropdown === "tools"}
                onClick={() => setComposerDropdown((current) => (current === "tools" ? null : "tools"))}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-[2] text-primary transition-colors duration-100"
                >
                  <path d="M6 12H18M12 6V18" stroke="currentColor" strokeLinecap="square" />
                </svg>
              </button>
              {composerDropdown === "tools" && (
                <div className="composer-menu tools-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setComposerDropdown(null);
                      chatImageInputRef.current?.click();
                    }}
                  >
                    <span className="tool-menu-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </span>
                    Attach image / video
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setComposerDropdown(null);
                      uploadInputRef.current?.click();
                    }}
                  >
                    <span className="tool-menu-icon">+</span>
                    Upload file
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setComposerDropdown(null);
                      onCreateImage();
                      screenshotInputRef.current?.click();
                    }}
                  >
                    <span className="tool-menu-icon">I</span>
                    Create image
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setComposerDropdown(null);
                      onGenerateDesignMd();
                    }}
                  >
                    <span className="tool-menu-icon">D</span>
                    Generate Design.md
                  </button>
                </div>
              )}
            </div>
            {workspaceTab === "code" && (
              <div className="composer-dropdown">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={composerDropdown === "category"}
                  onClick={() => setComposerDropdown((current) => (current === "category" ? null : "category"))}
                >
                  {request.category}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-[2] size-4 text-secondary"
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeLinecap="square" />
                  </svg>
                </button>
                {composerDropdown === "category" && (
                  <div className="composer-menu" role="listbox">
                    {PROJECT_CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={request.category === category ? "selected" : ""}
                        role="option"
                        aria-selected={request.category === category}
                        onClick={() => {
                          setRequest({ ...request, category });
                          setComposerDropdown(null);
                        }}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {workspaceTab === "code" && (
              <div className="composer-dropdown">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={composerDropdown === "design"}
                  onClick={() => {
                    setComposerDropdown((current) => (current === "design" ? null : "design"));
                    setDesignQuery("");
                  }}
                >
                  {selectedPreset.label}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-[2] size-4 text-secondary"
                  >
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeLinecap="square" />
                  </svg>
                </button>
                {composerDropdown === "design" && (
                  <div className="composer-menu design-menu" role="listbox">
                    <label className="composer-search">
                      <span>Search templates</span>
                      <input
                        value={designQuery}
                        onChange={(event) => setDesignQuery(event.target.value)}
                        placeholder="Airtable, Stripe, dashboard..."
                        autoFocus
                      />
                    </label>
                    {designEntries.map(([id, preset]) => (
                      <button
                        key={id}
                        type="button"
                        className={request.openDesign === id ? "selected" : ""}
                        role="option"
                        aria-selected={request.openDesign === id}
                        onClick={() => {
                          setRequest({ ...request, openDesign: id as OpenDesignPreset });
                          setComposerDropdown(null);
                          setDesignQuery("");
                        }}
                      >
                        <span>
                          {preset.label}
                          {templateMetaById.get(id)?.priority && <em>{templateMetaById.get(id)?.priority}</em>}
                        </span>
                        <small>{templateMetaById.get(id)?.category ?? id}</small>
                      </button>
                    ))}
                    {designEntries.length === 0 && <p className="composer-empty">No template found.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="composer-actions">
            <span>{isGenerating ? "Thinking" : "Ready"}</span>
            <div className="composer-dropdown model-dropdown">
              <button
                type="button"
                className="model-selector-btn"
                aria-haspopup="listbox"
                aria-expanded={composerDropdown === "model"}
                onClick={() => setComposerDropdown((c) => (c === "model" ? null : "model"))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {AI_MODELS.find((m) => m.value === groqModel)?.label ?? "Llama 3.3 70B"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" strokeLinecap="square" /></svg>
              </button>
              {composerDropdown === "model" && (
                <div className="composer-menu model-menu" role="listbox">
                  {AI_MODELS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      className={groqModel === m.value ? "selected" : ""}
                      role="option"
                      aria-selected={groqModel === m.value}
                      onClick={() => {
                        onModelChange(m.value);
                        setComposerDropdown(null);
                      }}
                    >
                      <span>{m.label}</span>
                      <small>{m.desc}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {workspaceTab === "code" && (
              <button
                className="design-md-send-button"
                type="button"
                disabled={isGenerating || !request.prompt.trim()}
                onClick={onGenerateDesignMd}
              >
                Design.md
              </button>
            )}
            <button
              className="send-button"
              type="submit"
              aria-label="Send chat message"
              disabled={isGenerating || (!request.prompt.trim() && pendingAttachments.length === 0)}
            >
              <span className="send-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
