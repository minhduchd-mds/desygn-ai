import { useState, useEffect, useCallback } from "react";
import type { PluginProfile, ComponentRef, FigmaImportSource } from "../../shared/types";
import { FigmaIcon } from "./FigmaIcon";
import { SkillIcon } from "./SkillIcon";
import styles from "./FigmaImportPanel.module.scss";

interface FigmaImportPanelProps {
  editProfile: PluginProfile;
  tokensText: string;
  onUpdateProfile: (profile: PluginProfile) => void;
  onUpdateTokensText: (text: string) => void;
  parseTokensText: (text: string) => Record<string, string>;
}

function isTrustedFigmaMessage(event: MessageEvent): boolean {
  if (event.source !== parent) return false;
  return event.origin === "null" || event.origin === "https://www.figma.com";
}

// Parse a skill/markdown file to extract tokens and guidelines
function parseSkillFile(content: string): { tokens: Record<string, string>; guidelines: string; components: string[] } {
  const tokens: Record<string, string> = {};
  const components: string[] = [];
  const guidelineLines: string[] = [];

  const cssVarRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
  let match;
  while ((match = cssVarRegex.exec(content)) !== null) {
    const name = match[1].trim();
    let value = match[2].trim();
    if (!value.startsWith("var(")) {
      value = value.replace(/\/\*.*?\*\//, "").trim();
      if (value) tokens[name] = value;
    }
  }

  const tokenLineRegex = /^([a-zA-Z0-9_-]+)\s*:\s*(#[0-9A-Fa-f]{3,8}|[\d.]+(?:px|rem|em|%))\s*$/gm;
  while ((match = tokenLineRegex.exec(content)) !== null) {
    tokens[match[1].trim()] = match[2].trim();
  }

  const componentHeaderRegex = /^##\s+([\w-]+)/gm;
  while ((match = componentHeaderRegex.exec(content)) !== null) {
    const name = match[1];
    if (
      !["Color", "Typography", "Spacing", "Border", "Shadow", "Transition", "Theme", "tokens", "rules", "verify"].includes(
        name,
      )
    ) {
      components.push(name);
    }
  }

  let inCodeBlock = false;
  for (const line of content.split("\n")) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    if (
      /\b(always|never|must|should|avoid|prefer|use|don't|do not|important|rule|convention)\b/i.test(line) &&
      line.trim().length > 20
    ) {
      const clean = line.replace(/^[\s*>-]+/, "").trim();
      if (clean) guidelineLines.push(clean);
    }
  }

  return { tokens, guidelines: guidelineLines.slice(0, 20).join("\n"), components };
}

// Module-level timers (single plugin instance, safe)
let loadingTimer: ReturnType<typeof setTimeout> | null = null;
let importTimer: ReturnType<typeof setTimeout> | null = null;

export function FigmaImportPanel({
  editProfile,
  tokensText,
  onUpdateProfile,
  onUpdateTokensText,
  parseTokensText,
}: FigmaImportPanelProps) {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [sources, setSources] = useState<FigmaImportSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [loadingSources, setLoadingSources] = useState(false);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!isTrustedFigmaMessage(event)) return;
      const msg = event.data?.pluginMessage;
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

      if (msg.type === "figma-sources-result") {
        if (!Array.isArray(msg.sources)) return;
        if (loadingTimer) clearTimeout(loadingTimer);
        setLoadingSources(false);
        const srcs = msg.sources as FigmaImportSource[];
        setSources(srcs);
        setSelectedSources(new Set(srcs.map((s) => s.id)));
        setShowSourcePicker(true);
        return;
      }

      if (msg.type !== "figma-tokens-result") return;
      if (!msg.tokens || typeof msg.tokens !== "object" || Array.isArray(msg.tokens) || !Array.isArray(msg.components)) return;

      if (importTimer) clearTimeout(importTimer);
      setImporting(false);

      const importedTokens = msg.tokens as Record<string, string>;
      const importedComponents = (msg.components as string[]).filter((name): name is string => typeof name === "string").map((name): ComponentRef => ({ name }));
      const fileName = typeof msg.fileName === "string" ? msg.fileName : "Figma file";

      const mergedTokens = { ...importedTokens };
      const existingTokens = parseTokensText(tokensText);
      for (const [k, v] of Object.entries(existingTokens)) {
        mergedTokens[k] = v;
      }

      const existingNames = new Set(editProfile.components.map((c) => c.name));
      const mergedComponents = [...editProfile.components, ...importedComponents.filter((c) => !existingNames.has(c.name))];

      onUpdateTokensText(
        Object.entries(mergedTokens)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
      );
      onUpdateProfile({
        ...editProfile,
        name: editProfile.name || fileName,
        components: mergedComponents,
      });

      const tokenCount = Object.keys(importedTokens).length;
      const compCount = importedComponents.length;
      setImportStatus(`Imported ${tokenCount} tokens + ${compCount} components from "${fileName}"`);
      setTimeout(() => setImportStatus(null), 4000);
    },
    [editProfile, tokensText, onUpdateProfile, onUpdateTokensText, parseTokensText],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const handleFigmaImport = () => {
    setLoadingSources(true);
    setImportStatus(null);
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      setLoadingSources(false);
      setImportStatus("Import timed out — try again or use a smaller file.");
    }, 8000);
    parent.postMessage({ pluginMessage: { type: "get-figma-sources" } }, "*");
  };

  const handleImportSelected = () => {
    if (selectedSources.size === 0) return;
    setShowSourcePicker(false);
    setImporting(true);
    if (importTimer) clearTimeout(importTimer);
    importTimer = setTimeout(() => {
      setImporting(false);
      setImportStatus("Import timed out — try again with fewer sources.");
    }, 15000);
    parent.postMessage({ pluginMessage: { type: "import-figma-tokens", sourceIds: Array.from(selectedSources) } }, "*");
  };

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSkillFileImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt,.css";
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const content = await file.text();
      const parsed = parseSkillFile(content);

      const existingTokens = parseTokensText(tokensText);
      const mergedTokens = { ...parsed.tokens, ...existingTokens };

      onUpdateTokensText(
        Object.entries(mergedTokens)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
      );

      const existingNames = new Set(editProfile.components.map((c) => c.name));
      const newComponents = parsed.components
        .filter((name) => !existingNames.has(name))
        .map((name): ComponentRef => ({ name }));

      const mergedGuidelines = editProfile.guidelines
        ? editProfile.guidelines + "\n" + parsed.guidelines
        : parsed.guidelines;

      onUpdateProfile({
        ...editProfile,
        name: editProfile.name || file.name.replace(/\.(md|txt|css)$/, ""),
        components: [...editProfile.components, ...newComponents],
        guidelines: mergedGuidelines,
      });

      const tokenCount = Object.keys(parsed.tokens).length;
      const compCount = parsed.components.length;
      const guideCount = parsed.guidelines.split("\n").filter(Boolean).length;
      setImportStatus(
        `Imported ${tokenCount} tokens, ${compCount} components, ${guideCount} guidelines from "${file.name}"`,
      );
      setTimeout(() => setImportStatus(null), 4000);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  return (
    <>
      <div className={styles.importRow}>
        <button className={styles.importBtn} onClick={handleFigmaImport} disabled={importing || loadingSources}>
          <FigmaIcon size={16} />
          {loadingSources ? "Loading..." : importing ? "Importing..." : "Import from Figma"}
        </button>
        <button className={styles.importBtn} onClick={handleSkillFileImport}>
          <SkillIcon size={16} />
          Import Skill File
        </button>
      </div>

      {showSourcePicker && (
        <div className={styles.sourcePicker}>
          <div className={styles.sourcePickerHeader}>Select sources to import</div>
          {sources.length === 0 ? (
            <div className={styles.sourcePickerEmpty}>No importable sources found in this file.</div>
          ) : (
            <>
              <div className={styles.sourcePickerList}>
                {sources.map((src) => (
                  <label key={src.id} className={styles.sourcePickerItem}>
                    <input
                      type="checkbox"
                      checked={selectedSources.has(src.id)}
                      onChange={() => toggleSource(src.id)}
                    />
                    <div className={styles.sourcePickerInfo}>
                      <span className={styles.sourcePickerName}>{src.name}</span>
                      <span className={styles.sourcePickerDetail}>
                        {src.detail || `${src.count} items`}
                        {src.type === "library" && <span className={styles.sourcePickerBadge}>Library</span>}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {importStatus && <div className={styles.importSuccess}>{importStatus}</div>}
              <button
                className={`btn-primary ${styles.sourcePickerBtn}`}
                onClick={handleImportSelected}
                disabled={selectedSources.size === 0}
              >
                Import {selectedSources.size} source{selectedSources.size !== 1 ? "s" : ""}
              </button>
              <button className={`btn-link ${styles.cancelLink}`} onClick={() => setShowSourcePicker(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {!showSourcePicker && importStatus && <div className={styles.importStatus}>{importStatus}</div>}
    </>
  );
}
