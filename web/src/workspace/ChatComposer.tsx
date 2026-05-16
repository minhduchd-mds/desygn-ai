import { useRef, useState } from "react";
import { useMemo } from "react";
import { DESIGN_MD_TEMPLATES } from "../design/templateRegistry";
import type { OpenDesignDefinition, OpenDesignPreset, ProjectRequest, SetProjectRequest } from "../app/types";

type ComposerDropdown = "tools" | "category" | "design" | null;

const PROJECT_CATEGORIES = ["SaaS", "AI tool", "E-commerce", "Landing page", "Dashboard"];

interface ChatComposerProps {
  isGenerating: boolean;
  openDesignPresets: Record<OpenDesignPreset, OpenDesignDefinition>;
  request: ProjectRequest;
  selectedPreset: OpenDesignDefinition;
  setRequest: SetProjectRequest;
  workspaceTab: "chat" | "code" | "checklist";
  onSendChat: () => void;
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
  onSendChat,
  onGenerateDesignMd,
  onCreateImage,
  onUploadMarkdownFiles,
  onUploadScreenshot,
}: ChatComposerProps) {
  const [composerDropdown, setComposerDropdown] = useState<ComposerDropdown>(null);
  const [designQuery, setDesignQuery] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
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
      className={`chat-composer ${isGenerating ? "is-generating" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSendChat();
      }}
    >
      <div className="composer-box">
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
                onSendChat();
                const el = event.target as HTMLTextAreaElement;
                requestAnimationFrame(() => {
                  el.style.height = "auto";
                });
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
              disabled={isGenerating || !request.prompt.trim()}
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
