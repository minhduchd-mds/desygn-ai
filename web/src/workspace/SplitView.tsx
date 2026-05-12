import { useEffect, useMemo, useRef, useState } from "react";
import { Marked, type Tokens } from "marked";
import JSZip from "jszip";
import type { Screen } from "../design/screenGenerator";
import { parseScreensFromMarkdown } from "../design/screenGenerator";
import { AUTOSAVE_INTERVAL_MS, BA_TEMPLATE_CONTENT, DEBOUNCE_MS } from "../design/constants";
import styles from "./SplitView.module.css";

interface SplitViewProps {
  initialScreens: Screen[];
  projectId: string;
  onExport: (markdown: string) => void;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function combineScreens(screens: Screen[]): string {
  return screens.map((screen) => screen.markdown).join("\n\n---\n\n");
}

function extractHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^##+\s+(.+)$/gm)].map((match) => match[1]);
}

const previewMarked = new Marked({
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens);
      return `<h${depth} id="${slugify(text)}">${text}</h${depth}>`;
    },
  },
});

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function updateScreenFromMarkdown(screen: Screen, markdown: string): Screen {
  const parsed = parseScreensFromMarkdown(markdown)[0];
  return {
    ...screen,
    markdown,
    components: parsed?.components ?? screen.components,
    colorTokens: parsed?.colorTokens ?? screen.colorTokens,
  };
}

export function SplitView({ initialScreens, projectId, onExport }: SplitViewProps) {
  const normalizedScreens = useMemo(() => initialScreens.slice(0, 5), [initialScreens]);
  const [editableScreens, setEditableScreens] = useState<Screen[]>(normalizedScreens);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeScreen, setActiveScreen] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const current = editableScreens[activeScreen] ?? editableScreens[0];
  const activeMarkdown = current?.markdown ?? "";
  const headings = extractHeadings(activeMarkdown);
  const previewHtml = previewMarked.parse(activeMarkdown, { async: false }) as string;
  const combinedMarkdown = combineScreens(editableScreens);

  useEffect(() => {
    const id = window.setInterval(() => {
      const screen = editableScreens[activeScreen];
      if (!screen) return;
      localStorage.setItem(`design-md-${projectId}-${screen.name}`, screen.markdown);
      setLastSaved(new Date());
    }, AUTOSAVE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [activeScreen, editableScreens, projectId]);

  const updateScreenMarkdown = (markdown: string) => {
    setEditableScreens((items) =>
      items.map((item, index) =>
        index === activeScreen ? updateScreenFromMarkdown(item, markdown) : item,
      ),
    );

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const key = `design-md-${projectId}-${current?.name ?? activeScreen}`;
      localStorage.setItem(key, markdown);
      setLastSaved(new Date());
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  const copyActive = async () => {
    await navigator.clipboard.writeText(activeMarkdown);
  };

  const exportZip = async () => {
    const zip = new JSZip();
    editableScreens.forEach((screen) => {
      zip.file(`screens/${slugify(screen.name) || "screen"}.md`, screen.markdown);
    });
    zip.file("DESIGN.md", combinedMarkdown);
    zip.file("BA_TEMPLATE.md", BA_TEMPLATE_CONTENT);
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${projectId || "design-md"}-handoff.zip`);
  };

  const exportDesignMd = () => {
    onExport(combinedMarkdown);
    downloadBlob(new Blob([combinedMarkdown], { type: "text/markdown;charset=utf-8" }), `${projectId || "design-md"}-DESIGN.md`);
  };

  return (
    <section className={styles.container}>
      <nav className={styles.tabs} aria-label="Screen tabs">
        {editableScreens.map((screen, index) => (
          <button
            key={screen.name}
            type="button"
            className={`${styles.tab} ${index === activeScreen ? styles.active : ""}`}
            onClick={() => setActiveScreen(index)}
          >
            {screen.name}
          </button>
        ))}
      </nav>

      <header className={styles.toolbar}>
        <div>
          <strong>Preview</strong>
          <button className={styles.button} type="button" onClick={() => setIsDark((current) => !current)}>
            {isDark ? "Light" : "Dark"}
          </button>
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.button} type="button" onClick={copyActive}>
            Copy
          </button>
          <button className={styles.button} type="button" onClick={exportDesignMd}>
            Export DESIGN.md
          </button>
          <button className={styles.button} type="button" onClick={exportZip}>
            Export ZIP
          </button>
        </div>
      </header>

      <div className={styles.panels}>
        <div className={styles.editPanel}>
          <textarea className={styles.textarea} value={activeMarkdown} onChange={(event) => updateScreenMarkdown(event.target.value)} />
          <div className={styles.savedStatus}>Last saved: {lastSaved ? lastSaved.toLocaleTimeString() : "Not saved yet"}</div>
        </div>
        <div className={`${styles.previewPanel} ${isDark ? styles.dark : styles.light}`}>
          <aside className={styles.previewNav}>
            {headings.map((heading) => (
              <button className={styles.navLink} key={heading} type="button" onClick={() => document.getElementById(slugify(heading))?.scrollIntoView({ behavior: "smooth" })}>
                {heading}
              </button>
            ))}
          </aside>
          <article className={styles.previewContent} dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    </section>
  );
}
