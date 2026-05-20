/**
 * WorkspaceResult — Extracted from main.tsx.
 *
 * Shows the generated Design.md output with multiple view modes:
 *  • Prompt (raw markdown)
 *  • Preview (rendered site-like view)
 *  • Edit (textarea editor)
 *  • Split (side-by-side screen panels via SplitView)
 */
import React, { Suspense, lazy } from "react";
import type { DesignContext, ValidationReport } from "../../../shared/designContext";
import type { Screen } from "../design/screenGenerator";

const SplitView = lazy(() => import("./SplitView").then((m) => ({ default: m.SplitView })));

// ── Types ────────────────────────────────────────────────────────

export type PreviewMode = "prompt" | "preview" | "edit" | "split";
export type PreviewTheme = "light" | "dark";

interface DesignMdSection {
  id: string;
  title: string;
  content: string;
}

interface PreviewNavSection {
  id: string;
  title: string;
}

interface ActiveDesign {
  label: string;
  direction: string;
  palette: string[];
  typography: string;
  layout: string[];
  rules: string[];
  donts: string[];
}

export interface WorkspaceResultProps {
  // View mode
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  previewTheme: PreviewTheme;
  setPreviewTheme: (theme: PreviewTheme) => void;

  // Screens
  generatedScreens: Screen[];

  // Design.md content
  designMd: string;
  savedDesignMd: string | null;
  designMdStatus: string;
  designMdSections: DesignMdSection[];

  // Edit mode
  editDraft: string;
  setEditDraft: (draft: string) => void;
  editSavedAt: string | null;
  setEditSavedAt: (ts: string | null) => void;
  resetDesignMdEdit: () => void;
  saveDesignMdEdit: () => void;
  setSavedDesignMd: (md: string) => void;

  // Toolbar actions
  outputTarget: string;
  projectName: string;
  downloadDesignMd: () => void;
  copyOutput: () => void;
  copiedOutput: boolean;

  // Validation
  validationReport: ValidationReport | null;
  designContext: DesignContext | null;

  // Preview data
  activeDesign: ActiveDesign;
  importedDesign: boolean;
  usageCommand: string;
  previewNavSections: PreviewNavSection[];
  scrollToPreviewSection: (id: string) => void;
  previewItems: string[];
  productName: string;
  repositoryUrl: string;

  // SplitView
  projectSlug: string;

  // Markdown renderer
  MarkdownSectionContent: React.ComponentType<{ content: string }>;
}

// ── Component ────────────────────────────────────────────────────

export function WorkspaceResult(props: WorkspaceResultProps) {
  const {
    previewMode, setPreviewMode, previewTheme, setPreviewTheme,
    generatedScreens, designMd, savedDesignMd, designMdStatus, designMdSections,
    editDraft, setEditDraft, editSavedAt, setEditSavedAt, resetDesignMdEdit, saveDesignMdEdit, setSavedDesignMd,
    outputTarget, projectName, downloadDesignMd, copyOutput, copiedOutput,
    validationReport, designContext, activeDesign, importedDesign, usageCommand,
    previewNavSections, scrollToPreviewSection, previewItems,
    productName, repositoryUrl, projectSlug,
    MarkdownSectionContent,
  } = props;

  return (
    <article className="message assistant result-message generated-pulse">
      <div className="builder-result-grid">
        <main className="builder-main-panel">
          {/* ── Toolbar ─────────────────────────────────── */}
          <div className="result-toolbar">
            <div>
              <button className={previewMode === "prompt" ? "active" : ""} type="button" onClick={() => setPreviewMode("prompt")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Design.md
              </button>
              <button className={previewMode === "preview" ? "active" : ""} type="button" onClick={() => setPreviewMode("preview")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Preview
              </button>
              <button className={previewMode === "edit" ? "active" : ""} type="button" onClick={() => setPreviewMode("edit")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              {generatedScreens.length > 0 && (
                <button className={previewMode === "split" ? "active" : ""} type="button" onClick={() => setPreviewMode("split")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>
                  </svg>
                  Split View
                </button>
              )}
              <span className={`design-status-badge ${savedDesignMd ? "edited" : ""}`}>{designMdStatus}</span>
            </div>
            <nav>
              <span className="target-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                {outputTarget}
              </span>
              <button type="button" className="toolbar-btn-icon" title="Download Design.md" onClick={downloadDesignMd}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Download</span>
              </button>
              <button type="button" className={`toolbar-btn-icon ${copiedOutput ? "is-copied" : ""}`} title="Copy to clipboard" onClick={copyOutput}>
                {copiedOutput ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
                <span>{copiedOutput ? "Copied" : "Copy"}</span>
              </button>
            </nav>
          </div>

          {/* ── Validation summary ──────────────────────── */}
          {validationReport && (
            <div className={`validation-summary ${validationReport.readinessScore >= 60 ? "is-good" : validationReport.readinessScore >= 40 ? "is-warning" : "is-danger"}`}>
              <strong>Readiness {validationReport.readinessScore}/100</strong>
              <span>Components {validationReport.componentScore}</span>
              <span>Tokens {validationReport.tokenScore}</span>
              <span>Naming {validationReport.namingScore}</span>
              {designContext?.selectedTemplateId && <span>Template {designContext.selectedTemplateId}</span>}
              {!validationReport.canProceed && <em>Fix missing items to proceed: {[...validationReport.missingComponents, ...validationReport.missingTokens].slice(0, 4).join(", ") || "component scan"}</em>}
            </div>
          )}

          {/* ── Output panel ────────────────────────────── */}
          <div className="output-panel">
            {previewMode === "split" && generatedScreens.length > 0 ? (
              <Suspense fallback={<div style={{ padding: 24, color: "#5c6378" }}>Loading SplitView...</div>}>
                <SplitView
                  key={`${projectSlug}-${generatedScreens.map((s) => s.name).join("|")}`}
                  initialScreens={generatedScreens}
                  projectId={projectSlug}
                  onExport={(markdown) => {
                    setSavedDesignMd(markdown);
                    setEditDraft(markdown);
                    setPreviewMode("edit");
                  }}
                />
              </Suspense>
            ) : previewMode === "prompt" ? (
              <pre>{designMd}</pre>
            ) : previewMode === "edit" ? (
              <div className="design-md-editor">
                <div className="editor-header">
                  <div>
                    <span>Edit file</span>
                    <strong>DESIGN.md</strong>
                  </div>
                  <nav>
                    {editSavedAt && <span className="save-status">Saved {editSavedAt}</span>}
                    {savedDesignMd && <button type="button" onClick={resetDesignMdEdit}>Reset</button>}
                    <button type="button" className="save-button" onClick={saveDesignMdEdit}>Save changes</button>
                  </nav>
                </div>
                <textarea
                  value={editDraft}
                  onChange={(event) => {
                    setEditDraft(event.target.value);
                    setEditSavedAt(null);
                  }}
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className={`web-preview design-md-site-preview ${previewTheme}`}>
                <section className="design-md-detail-hero">
                  <span className="preview-kicker">{productName}</span>
                  <h2>Design System inspired by {activeDesign.label}</h2>
                  <p>{activeDesign.direction}</p>
                  <div className="usage-card">
                    <span>Usage</span>
                    <code>{usageCommand}</code>
                  </div>
                  <a className="repository-link" href={repositoryUrl} target="_blank" rel="noreferrer">
                    GitHub: minhduchd-mds/desygn-ai
                  </a>
                  <p className="preview-disclaimer">
                    This preview is generated from Design.md context and is not affiliated with the referenced brand.
                  </p>
                </section>

                <section className="design-md-preview-section">
                  <div className="preview-section-toolbar">
                    <div>
                      <span>Preview</span>
                      <strong>DESIGN.md</strong>
                    </div>
                    <div className="theme-toggle" aria-label="Preview theme">
                      <button type="button" className={previewTheme === "light" ? "active" : ""} onClick={() => setPreviewTheme("light")}>Light</button>
                      <button type="button" className={previewTheme === "dark" ? "active" : ""} onClick={() => setPreviewTheme("dark")}>Dark</button>
                    </div>
                  </div>

                  <div className="design-md-preview-frame">
                    <aside>
                      <strong>{activeDesign.label}</strong>
                      {previewNavSections.map((section) => (
                        <button type="button" key={section.id} onClick={() => scrollToPreviewSection(section.id)}>
                          {section.title}
                        </button>
                      ))}
                    </aside>
                    <main>
                      <div className="preview-frame-topbar">
                        <span /><span /><span />
                        <b>{projectName}</b>
                      </div>
                      <section className="preview-frame-content">
                        <p className="preview-label">{importedDesign ? "Imported Design.md" : "Open Design template"}</p>
                        <h3>{projectName}</h3>
                        <p>{activeDesign.direction}</p>
                        <div className="markdown-document-sections">
                          {designMdSections.slice(0, 6).map((section) => (
                            <article id={`preview-section-${section.id}`} key={section.id} className="markdown-document-section">
                              <span>{section.title}</span>
                              <MarkdownSectionContent content={section.content} />
                            </article>
                          ))}
                        </div>
                        <div className="palette-strip">
                          {activeDesign.palette.map((color) => (
                            <div key={color} style={{ background: color }}>
                              <span>{color}</span>
                            </div>
                          ))}
                        </div>
                        <div className="catalog-grid">
                          <div className="type-sample">
                            <span>Typography</span>
                            <h3>Readable AI interface</h3>
                            <p>{activeDesign.typography}</p>
                          </div>
                          <div className="component-sample">
                            <span>Components</span>
                            <div className="sample-controls">
                              <button>Primary action</button>
                              <button>Secondary</button>
                              <label>
                                Prompt field
                                <input value="Generate a SaaS dashboard" readOnly />
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="catalog-columns">
                          <div>
                            <span>Layout</span>
                            {activeDesign.layout.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
                          </div>
                          <div>
                            <span>Do</span>
                            {activeDesign.rules.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
                          </div>
                          <div>
                            <span>Do not</span>
                            {activeDesign.donts.slice(0, 4).map((item) => <p key={item}>{item}</p>)}
                          </div>
                        </div>
                        <div className="preview-grid">
                          {previewItems.map((item) => <div key={item}>{item}</div>)}
                        </div>
                      </section>
                    </main>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </article>
  );
}
