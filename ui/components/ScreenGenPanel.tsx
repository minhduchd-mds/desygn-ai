import { useState, useMemo } from "react";
import type { DesignSystemComponentInfo, DesignSystemVariableInfo } from "../../shared/types";
import type { BADocument } from "./BADocumentPanel";
import type { StandardItem } from "./StandardsChecklist";
import { sendPluginMessage } from "../lib/pluginMessage";
import { useI18n } from "../i18n/I18nContext";
import styles from "./ScreenGenPanel.module.css";

interface ScreenGenPanelProps {
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  baDocument: BADocument | null;
  standards: StandardItem[];
  layoutTemplate: string;
  projectName: string;
  industry: string;
  style: string;
}

interface ScreenConfig {
  name: string;
  description: string;
  sections: string[];
  includeStates: boolean;
}

const SCREEN_PRESETS: Record<string, ScreenConfig[]> = {
  Dashboard: [
    { name: "Dashboard Overview", description: "Main KPI and metrics view", sections: ["Navigation", "KPI Cards", "Charts", "Activity Feed"], includeStates: true },
    { name: "Dashboard Detail", description: "Detailed data view with filters", sections: ["Header", "Filters", "Data Table", "Pagination"], includeStates: true },
  ],
  "Admin table": [
    { name: "Table List", description: "Main data table with CRUD", sections: ["Header", "Search/Filter Bar", "Table", "Pagination", "Empty State"], includeStates: true },
    { name: "Table Detail", description: "Single record detail/edit", sections: ["Breadcrumb", "Detail Header", "Form Fields", "Actions"], includeStates: true },
    { name: "Table Create", description: "New record creation form", sections: ["Header", "Form", "Validation", "Submit"], includeStates: true },
  ],
  Settings: [
    { name: "Settings Overview", description: "Settings navigation and general", sections: ["Sidebar Nav", "Settings Form", "Save Actions"], includeStates: true },
    { name: "Settings Profile", description: "User profile settings", sections: ["Avatar Upload", "Profile Fields", "Password Change", "Danger Zone"], includeStates: true },
  ],
  "Landing page": [
    { name: "Landing Hero", description: "Hero section with CTA", sections: ["Nav", "Hero", "Social Proof"], includeStates: false },
    { name: "Landing Features", description: "Features and pricing", sections: ["Feature Grid", "Pricing Cards", "FAQ"], includeStates: false },
    { name: "Landing Footer", description: "Footer with links", sections: ["CTA Banner", "Footer Links", "Newsletter"], includeStates: false },
  ],
  "Mobile app": [
    { name: "Mobile Home", description: "Mobile app main screen", sections: ["Status Bar", "Header", "Content List", "Tab Bar"], includeStates: true },
    { name: "Mobile Detail", description: "Content detail view", sections: ["Back Nav", "Hero Image", "Content", "Action Button"], includeStates: true },
  ],
  "AI workspace": [
    { name: "AI Chat", description: "Main chat interface", sections: ["Sidebar", "Conversation", "Prompt Input", "Model Selector"], includeStates: true },
    { name: "AI Settings", description: "AI model and preferences", sections: ["Model Config", "System Prompt", "API Keys"], includeStates: true },
  ],
  "Developer console": [
    { name: "Console Dashboard", description: "API overview", sections: ["Nav", "API Keys", "Usage Charts", "Logs"], includeStates: true },
    { name: "Console Playground", description: "API playground", sections: ["Endpoint Selector", "Request Builder", "Response View"], includeStates: true },
  ],
};

function buildScreenPrompt(
  config: ScreenConfig,
  components: DesignSystemComponentInfo[],
  variables: DesignSystemVariableInfo[],
  baDocument: BADocument | null,
  standards: StandardItem[],
  projectName: string,
  industry: string,
  style: string,
): string {
  const checkedStandards = standards.filter(s => s.checked);
  const iconComponents = components.filter(c => /icon|ico|glyph/i.test(c.name));
  const availableComponents = components.filter(c => !/icon|ico|glyph/i.test(c.name));

  let prompt = `## Screen: ${config.name}\n${config.description}\n\n`;
  prompt += `**Project:** ${projectName} | **Industry:** ${industry} | **Style:** ${style}\n\n`;

  prompt += `### Sections\n`;
  config.sections.forEach((s, i) => { prompt += `${i + 1}. ${s}\n`; });

  if (config.includeStates) {
    prompt += `\n### Required States\n- Default\n- Loading (skeleton)\n- Empty\n- Error\n- Hover/Active on interactive elements\n`;
  }

  if (availableComponents.length > 0) {
    prompt += `\n### Available Components (use these)\n`;
    availableComponents.slice(0, 30).forEach(c => {
      prompt += `- **${c.name}** (${c.role ?? "component"})${c.variantProperties ? ` — variants: ${Object.keys(c.variantProperties).join(", ")}` : ""}\n`;
    });
  }

  if (iconComponents.length > 0) {
    prompt += `\n### Icon Set (${iconComponents.length} icons synced)\n`;
    prompt += `Use icons from the design file. Style: ${iconComponents[0]?.name?.includes("outline") ? "outline" : iconComponents[0]?.name?.includes("filled") ? "filled" : "consistent with design system"}.\n`;
    prompt += `Available: ${iconComponents.slice(0, 20).map(c => c.name).join(", ")}${iconComponents.length > 20 ? ` +${iconComponents.length - 20} more` : ""}\n`;
  } else {
    prompt += `\n### Icons\nNo icon set synced. Use Lucide icons (outline style) for consistency. All icons should be same style — do not mix outline and filled.\n`;
  }

  if (variables.length > 0) {
    const colorVars = variables.filter(v => /color|fill|bg|surface|text|border/i.test(v.name)).slice(0, 15);
    if (colorVars.length > 0) {
      prompt += `\n### Color Tokens\n`;
      colorVars.forEach(v => { prompt += `- \`${v.name}\`: ${v.value}\n`; });
    }
  }

  if (baDocument?.content) {
    prompt += `\n### Business Requirements (from BA Document)\n`;
    const relevantBA = baDocument.screens.find(s =>
      config.name.toLowerCase().includes(s.name.toLowerCase()) ||
      s.name.toLowerCase().includes(config.name.toLowerCase().split(" ")[0])
    );
    if (relevantBA) {
      prompt += `**Screen:** ${relevantBA.name}\n${relevantBA.description}\n`;
      if (relevantBA.acceptanceCriteria.length > 0) {
        prompt += `**Acceptance Criteria:**\n`;
        relevantBA.acceptanceCriteria.forEach(c => { prompt += `- ${c}\n`; });
      }
    } else {
      prompt += `(No specific screen match in BA doc — use general business context)\n`;
    }
  }

  if (checkedStandards.length > 0) {
    prompt += `\n### Quality Standards (must follow)\n`;
    checkedStandards.forEach(s => { prompt += `- ${s.label}\n`; });
  }

  return prompt;
}

export function ScreenGenPanel({
  components, variables, baDocument, standards, layoutTemplate, projectName, industry, style,
}: ScreenGenPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [screenCount, setScreenCount] = useState(2);
  const [selectedScreens, setSelectedScreens] = useState<Set<number>>(new Set([0, 1]));
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const { t } = useI18n();

  const presetScreens = useMemo(() => SCREEN_PRESETS[layoutTemplate] ?? SCREEN_PRESETS["Dashboard"]!, [layoutTemplate]);

  const activeScreens = useMemo(() => {
    const screens: ScreenConfig[] = [];
    for (let i = 0; i < Math.min(screenCount, presetScreens.length); i++) {
      if (selectedScreens.has(i)) screens.push(presetScreens[i]);
    }
    return screens;
  }, [screenCount, selectedScreens, presetScreens]);

  const toggleScreen = (idx: number) => {
    setSelectedScreens(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { if (next.size > 1) next.delete(idx); }
      else next.add(idx);
      return next;
    });
  };

  const handleGenerate = () => {
    setGenerating(true);
    setGenStatus(null);
    sendPluginMessage({
      type: "create-figma-project-frame",
      project: {
        projectName,
        industry,
        style,
        presetName: style,
        layoutTemplate,
        components,
        variables,
        templateComponentMappings: {},
      },
    } as never);

    const handleResult = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type === "figma-project-frame-result") {
        setGenerating(false);
        setGenStatus(msg.message);
        window.removeEventListener("message", handleResult);
      }
    };
    window.addEventListener("message", handleResult);
  };

  const copyScreenPrompt = async (idx: number) => {
    const screen = activeScreens[idx];
    if (!screen) return;
    const prompt = buildScreenPrompt(screen, components, variables, baDocument, standards, projectName, industry, style);
    await navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const copyAllPrompts = async () => {
    const all = activeScreens.map(s =>
      buildScreenPrompt(s, components, variables, baDocument, standards, projectName, industry, style)
    ).join("\n\n---\n\n");
    await navigator.clipboard.writeText(all);
    setCopiedIdx(-1);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className={styles.root}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>{t.screenGeneration}</span>
          <span className={styles.badge}>{activeScreens.length} {t.screens}</span>
        </div>
        <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.config}>
            <label className={styles.field}>
              <span>{t.numberOfScreens}</span>
              <input
                type="range"
                min={1}
                max={presetScreens.length}
                value={screenCount}
                onChange={e => {
                  const n = Number(e.target.value);
                  setScreenCount(n);
                  const next = new Set<number>();
                  for (let i = 0; i < n; i++) next.add(i);
                  setSelectedScreens(next);
                }}
              />
              <span className={styles.countLabel}>{screenCount}</span>
            </label>
          </div>

          <div className={styles.screenList}>
            {presetScreens.slice(0, screenCount).map((screen, idx) => (
              <label key={idx} className={`${styles.screenCard} ${selectedScreens.has(idx) ? styles.selected : ""}`}>
                <input type="checkbox" checked={selectedScreens.has(idx)} onChange={() => toggleScreen(idx)} />
                <div className={styles.screenInfo}>
                  <strong>{screen.name}</strong>
                  <span className={styles.screenDesc}>{screen.description}</span>
                  <div className={styles.screenSections}>
                    {screen.sections.map(s => (
                      <span key={s} className={styles.sectionChip}>{s}</span>
                    ))}
                  </div>
                  {screen.includeStates && <span className={styles.statesBadge}>+ states</span>}
                </div>
                <button
                  className="btn-link"
                  onClick={e => { e.preventDefault(); copyScreenPrompt(idx); }}
                  style={{ flexShrink: 0, fontSize: 10 }}
                >
                  {copiedIdx === idx ? t.copied : t.copy}
                </button>
              </label>
            ))}
          </div>

          <div className={styles.actions}>
            <button className="btn-primary btn-sm" onClick={handleGenerate} disabled={generating || activeScreens.length === 0}>
              {generating ? t.generating : t.exportToFigma(activeScreens.length)}
            </button>
            <button className="btn-secondary btn-sm" onClick={copyAllPrompts}>
              {copiedIdx === -1 ? t.copied : t.copyAllPrompts}
            </button>
          </div>

          {genStatus && <div className={styles.status}>{genStatus}</div>}

          <p className={styles.hint}>
            {t.screenGenHint}
          </p>
        </div>
      )}
    </div>
  );
}
