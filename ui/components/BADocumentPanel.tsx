import { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";
import styles from "./BADocumentPanel.module.css";

interface BADocumentPanelProps {
  onDocumentChange: (doc: BADocument) => void;
  initialDoc?: BADocument | null;
}

export interface BADocument {
  title: string;
  content: string;
  screens: BAScreen[];
  updatedAt: string;
}

export interface BAScreen {
  id: string;
  name: string;
  description: string;
  userStory: string;
  acceptanceCriteria: string[];
}

const STORAGE_KEY = "designready-ba-document";

const BA_TEMPLATE = `# Business Analysis Document

## Project Overview
[Project name and brief description]

## User Personas
- **Primary User**: [Role, goals, pain points]
- **Secondary User**: [Role, goals, pain points]

## User Stories

### US-001: [Feature Name]
**As a** [user role]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### US-002: [Feature Name]
**As a** [user role]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Screen Specifications

### Screen 1: [Screen Name]
- **Purpose**: [What this screen does]
- **Entry points**: [How users navigate here]
- **Key actions**: [Primary and secondary actions]
- **Data displayed**: [What information is shown]
- **States**: [Empty, loading, error, populated]

### Screen 2: [Screen Name]
- **Purpose**: [What this screen does]
- **Entry points**: [How users navigate here]
- **Key actions**: [Primary and secondary actions]

## Business Rules
1. [Rule description]
2. [Rule description]

## Data Requirements
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| [field] | [type] | [yes/no] | [rules] |

## Non-Functional Requirements
- **Performance**: [Response time, load time targets]
- **Security**: [Authentication, authorization rules]
- **Accessibility**: [WCAG level, screen reader support]
`;

function loadFromStorage(): BADocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(doc: BADocument) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch { /* quota exceeded */ }
}

function parseScreensFromContent(content: string): BAScreen[] {
  const screens: BAScreen[] = [];
  const screenRegex = /### Screen \d+:\s*(.+)/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = screenRegex.exec(content)) !== null) {
    const name = match[1].replace(/\[|\]/g, "").trim();
    const startPos = match.index + match[0].length;
    const nextScreen = content.indexOf("### Screen", startPos);
    const nextSection = content.indexOf("\n## ", startPos);
    const endPos = Math.min(
      nextScreen > -1 ? nextScreen : content.length,
      nextSection > -1 ? nextSection : content.length,
    );
    const block = content.slice(startPos, endPos).trim();

    const purposeMatch = block.match(/\*\*Purpose\*\*:\s*(.+)/);
    const criteria: string[] = [];
    const criteriaMatches = block.matchAll(/- \[[ x]\]\s*(.+)/g);
    for (const cm of criteriaMatches) criteria.push(cm[1]);

    screens.push({
      id: `screen-${idx++}`,
      name: name || `Screen ${idx}`,
      description: purposeMatch?.[1]?.replace(/\[|\]/g, "").trim() ?? "",
      userStory: "",
      acceptanceCriteria: criteria,
    });
  }

  return screens;
}

function useInitialDoc(initialDoc: BADocument | null | undefined, onDocumentChange: (doc: BADocument) => void) {
  const stored = !initialDoc ? loadFromStorage() : null;
  const initTitle = initialDoc?.title ?? stored?.title ?? "";
  const initContent = initialDoc?.content ?? stored?.content ?? "";
  // Notify parent once on mount if we loaded from storage
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (stored && !notifiedRef.current) {
      notifiedRef.current = true;
      onDocumentChange(stored);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { initTitle, initContent };
}

export function BADocumentPanel({ onDocumentChange, initialDoc }: BADocumentPanelProps) {
  const { initTitle, initContent } = useInitialDoc(initialDoc, onDocumentChange);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initTitle);
  const [content, setContent] = useState(initContent);
  const [saved, setSaved] = useState(false);
  const { t } = useI18n();

  const handleSave = () => {
    const screens = parseScreensFromContent(content);
    const doc: BADocument = {
      title: title || "BA Document",
      content,
      screens,
      updatedAt: new Date().toISOString(),
    };
    saveToStorage(doc);
    onDocumentChange(doc);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoadTemplate = () => {
    setContent(BA_TEMPLATE);
    setTitle("BA Document");
    setEditing(true);
  };

  const handleImportFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt,.doc";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setContent(text);
        setTitle(file.name.replace(/\.[^.]+$/, ""));
        setEditing(true);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClear = () => {
    setTitle("");
    setContent("");
    localStorage.removeItem(STORAGE_KEY);
    onDocumentChange({ title: "", content: "", screens: [], updatedAt: "" });
  };

  const screenCount = parseScreensFromContent(content).length;

  return (
    <div className={styles.root}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>{t.baDocument}</span>
          {content && (
            <span className={styles.badge}>
              {title || t.baDocLoaded} · {screenCount} {t.screens}
            </span>
          )}
        </div>
        <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {!content && !editing ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                {t.baDocEmptyText}
              </p>
              <div className={styles.emptyActions}>
                <button className="btn-primary btn-sm" onClick={handleLoadTemplate}>
                  {t.useTemplate}
                </button>
                <button className="btn-secondary btn-sm" onClick={handleImportFile}>
                  {t.importFile}
                </button>
              </div>
            </div>
          ) : editing ? (
            <div className={styles.editor}>
              <input
                className={styles.titleInput}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t.documentTitle}
              />
              <textarea
                className={styles.textarea}
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={16}
                placeholder={t.pasteOrWrite}
              />
              <div className={styles.editorActions}>
                <button className="btn-primary btn-sm" onClick={handleSave}>
                  {t.saveDocument}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <strong>{title}</strong>
                <div className={styles.previewActions}>
                  <button className="btn-link" onClick={() => setEditing(true)}>{t.edit}</button>
                  <button className="btn-link" onClick={handleImportFile}>{t.reImport}</button>
                  <button className="btn-link" style={{ color: "var(--dr-error, #f24822)" }} onClick={handleClear}>{t.clear}</button>
                </div>
              </div>
              {saved && <span className={styles.savedBadge}>{t.saved}</span>}
              <pre className={styles.previewContent}>{content.slice(0, 800)}{content.length > 800 ? `\n\n${t.truncatedPreview}` : ""}</pre>
              {screenCount > 0 && (
                <div className={styles.screenList}>
                  <span className={styles.screenLabel}>{t.detectedScreens}</span>
                  {parseScreensFromContent(content).map(s => (
                    <span key={s.id} className={styles.screenChip}>{s.name}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
