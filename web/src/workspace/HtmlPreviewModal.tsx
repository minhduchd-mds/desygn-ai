import { useEffect, useRef, useState } from "react";
import styles from "./HtmlPreviewModal.module.css";

export interface HtmlPreviewState {
  html: string;
  title?: string;
}

interface Props {
  state: HtmlPreviewState;
  onClose: () => void;
  onHtmlChange: (html: string) => void;
}

type PanelMode = "preview" | "split" | "code";

const ZOOM_STEPS = [40, 60, 75, 100, 125, 150, 200];

export function HtmlPreviewModal({ state, onClose, onHtmlChange }: Props) {
  const [activeHtml, setActiveHtml] = useState(state.html);
  const [codeDraft, setCodeDraft] = useState(state.html);
  const [mode, setMode] = useState<PanelMode>("preview");
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyCode() {
    setActiveHtml(codeDraft);
    onHtmlChange(codeDraft);
    setMode("split");
  }

  function zoomIn() {
    const next = ZOOM_STEPS.find((s) => s > zoom);
    if (next) setZoom(next);
  }

  function zoomOut() {
    const prev = [...ZOOM_STEPS].reverse().find((s) => s < zoom);
    if (prev) setZoom(prev);
  }

  function resetZoom() { setZoom(100); }

  function downloadHtml() {
    const blob = new Blob([activeHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(state.title ?? "preview").replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openInNewTab() {
    const blob = new Blob([activeHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(activeHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scale = zoom / 100;

  const previewPane = (
    <div className={styles.previewPane}>
      <div className={styles.iframeWrapper} ref={wrapperRef}>
        <iframe
          key={activeHtml}
          className={styles.previewIframe}
          style={{
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
          }}
          srcDoc={activeHtml}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="HTML Preview"
        />
      </div>
    </div>
  );

  const codePane = (
    <div className={styles.codePane}>
      <div className={styles.codeHeader}>
        <span className={styles.codeHeaderLabel}>HTML source</span>
        <button className={styles.applyBtn} onClick={applyCode}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Apply
        </button>
      </div>
      <textarea
        className={styles.codeTextarea}
        value={codeDraft}
        onChange={(e) => setCodeDraft(e.target.value)}
        spellCheck={false}
      />
    </div>
  );

  return (
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.modal} ${isFullscreen ? styles.isFullscreen : ""}`}>

        {/* ── Toolbar ── */}
        <div className={styles.toolbar}>
          {/* Left */}
          <div className={styles.toolbarLeft}>
            {/* Live dot + title */}
            <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0 }}>
              <circle cx="4" cy="4" r="4" fill="#22c55e"/>
            </svg>
            <span className={styles.toolbarTitle}>{state.title ?? "Live Preview"}</span>

            {/* Mode tabs */}
            <div className={styles.modeTabs}>
              <button className={`${styles.modeTab} ${mode === "preview" ? styles.active : ""}`} onClick={() => setMode("preview")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Preview
              </button>
              <button className={`${styles.modeTab} ${mode === "split" ? styles.active : ""}`} onClick={() => setMode("split")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>
                </svg>
                Split
              </button>
              <button className={`${styles.modeTab} ${mode === "code" ? styles.active : ""}`} onClick={() => setMode("code")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                Code
              </button>
            </div>
          </div>

          {/* Center — zoom */}
          <div className={styles.zoomRow}>
            <button className={styles.zoomBtn} onClick={zoomOut} disabled={zoom <= ZOOM_STEPS[0]} title="Zoom out">−</button>
            <button className={styles.zoomLabel} onClick={resetZoom} title="Reset zoom">{zoom}%</button>
            <button className={styles.zoomBtn} onClick={zoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} title="Zoom in">+</button>
          </div>

          {/* Right */}
          <div className={styles.toolbarRight}>
            <button className={styles.iconBtn} onClick={openInNewTab} title="Open in new tab">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open
            </button>
            <button className={styles.iconBtn} onClick={copyCode} title="Copy HTML">
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className={styles.iconBtn} onClick={downloadHtml} title="Download .html">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                  <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              )}
            </button>
            <button className={`${styles.iconBtn} ${styles.iconBtnClose}`} onClick={onClose} title="Close">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className={styles.content}>
          {mode === "preview" && previewPane}
          {mode === "split" && <>{previewPane}{codePane}</>}
          {mode === "code" && codePane}
        </div>

        {/* ── URL bar ── */}
        <div className={styles.urlBar}>
          <div className={styles.urlDot} />
          <span className={styles.urlText}>blob: · {state.title ?? "preview"}.html · {activeHtml.length.toLocaleString()} bytes</span>
        </div>

      </div>
    </div>
  );
}
