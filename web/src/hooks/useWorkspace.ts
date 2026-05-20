/**
 * useWorkspace — Project & workspace state hook extracted from main.tsx.
 *
 * Manages workspace tab, project request, project history, preview mode,
 * generation state, Groq model selection, template loading, settings/brand UI,
 * and checklist state.
 */

import { useCallback, useEffect, useState } from "react";
import type { ProjectHistoryItem, ProjectRequest, OpenDesignDefinition } from "../app/types";
import { getProjectHistory, saveProjectHistory } from "../app/auth";
import { hasDesignMdTemplate, loadDesignMdTemplate, type DesignMdTemplateCategory } from "../design/templateRegistry";
import { parseDesignMd } from "../design/designParser";
import { DEFAULT_CHECKLIST_ROWS, type ChecklistRow, type DesignSource } from "../workspace/checklistData";
import type { IntegrationItem } from "../workspace/SettingsModal";

// ── Types ─────────────────────────────────────────────────────

type PreviewMode = "prompt" | "preview" | "edit" | "split";
type PreviewTheme = "light" | "dark";
type TemplatePriorityFilter = "All" | "Product" | "Technical";
type TemplateCategoryFilter = "All" | DesignMdTemplateCategory;

export interface UseWorkspaceReturn {
  /* workspace tab */
  workspaceTab: "chat" | "code" | "checklist";
  setWorkspaceTab: React.Dispatch<React.SetStateAction<"chat" | "code" | "checklist">>;

  /* project request */
  request: ProjectRequest;
  setRequest: React.Dispatch<React.SetStateAction<ProjectRequest>>;
  generatedRequest: ProjectRequest | null;
  setGeneratedRequest: React.Dispatch<React.SetStateAction<ProjectRequest | null>>;

  /* project history */
  projectHistory: ProjectHistoryItem[];
  setProjectHistory: React.Dispatch<React.SetStateAction<ProjectHistoryItem[]>>;
  activeHistoryPrompt: string;
  setActiveHistoryPrompt: React.Dispatch<React.SetStateAction<string>>;
  isHistoryOpen: boolean;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveGeneratedProject: (req: ProjectRequest) => void;

  /* sidebar */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  /* preview */
  previewMode: PreviewMode;
  setPreviewMode: React.Dispatch<React.SetStateAction<PreviewMode>>;
  previewTheme: PreviewTheme;
  setPreviewTheme: React.Dispatch<React.SetStateAction<PreviewTheme>>;
  hasGenerated: boolean;
  setHasGenerated: React.Dispatch<React.SetStateAction<boolean>>;
  copiedOutput: boolean;
  setCopiedOutput: React.Dispatch<React.SetStateAction<boolean>>;

  /* model */
  groqModel: string;
  setGroqModel: React.Dispatch<React.SetStateAction<string>>;

  /* templates */
  loadedTemplatePresets: Record<string, OpenDesignDefinition>;
  setLoadedTemplatePresets: React.Dispatch<React.SetStateAction<Record<string, OpenDesignDefinition>>>;
  landingTemplateQuery: string;
  setLandingTemplateQuery: React.Dispatch<React.SetStateAction<string>>;
  landingTemplatePriority: TemplatePriorityFilter;
  setLandingTemplatePriority: React.Dispatch<React.SetStateAction<TemplatePriorityFilter>>;
  landingTemplateCategory: TemplateCategoryFilter;
  setLandingTemplateCategory: React.Dispatch<React.SetStateAction<TemplateCategoryFilter>>;

  /* modals / popups */
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templatePopupOpen: boolean;
  setTemplatePopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setupModalOpen: boolean;
  setSetupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setupModalTab: number;
  setSetupModalTab: React.Dispatch<React.SetStateAction<number>>;

  /* brand / settings */
  brandMenuOpen: boolean;
  setBrandMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  brandHelpOpen: boolean;
  setBrandHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsTab: "profile" | "appearance" | "behavior" | "notifications" | "extensions" | "document" | "other";
  setSettingsTab: React.Dispatch<React.SetStateAction<"profile" | "appearance" | "behavior" | "notifications" | "extensions" | "document" | "other">>;
  shareLinksEnabled: boolean;
  setShareLinksEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  displayName: string;
  setDisplayName: React.Dispatch<React.SetStateAction<string>>;
  chatTheme: "dark" | "light";
  setChatTheme: React.Dispatch<React.SetStateAction<"dark" | "light">>;

  /* integrations */
  integrations: IntegrationItem[];
  setIntegrations: React.Dispatch<React.SetStateAction<IntegrationItem[]>>;
  saveIntegrations: (next: IntegrationItem[]) => void;
  figmaMcpEndpoint: string;
  setFigmaMcpEndpoint: React.Dispatch<React.SetStateAction<string>>;
  chatMappingEnabled: boolean;
  setChatMappingEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  /* checklist */
  checklistItems: ChecklistRow[];
  setChecklistItems: React.Dispatch<React.SetStateAction<ChecklistRow[]>>;
  checklistSearch: string;
  setChecklistSearch: React.Dispatch<React.SetStateAction<string>>;
  checklistFilter: "all" | "ui" | "ux" | "pass" | "fail" | "warn" | "untested";
  setChecklistFilter: React.Dispatch<React.SetStateAction<"all" | "ui" | "ux" | "pass" | "fail" | "warn" | "untested">>;
  checklistSourceFilter: "all" | DesignSource;
  checklistCatFilter: string;
  setChecklistCatFilter: React.Dispatch<React.SetStateAction<string>>;
  checklistPage: number;
  setChecklistPage: React.Dispatch<React.SetStateAction<number>>;
  checklistPerPage: number;
  setChecklistPerPage: React.Dispatch<React.SetStateAction<number>>;

  /* setup datasource */
  setupDatasource: { type: string; url: string; sheet: string; headerRow: number };
  setSetupDatasource: React.Dispatch<React.SetStateAction<{ type: string; url: string; sheet: string; headerRow: number }>>;
  figmaToken: string;
  setFigmaToken: React.Dispatch<React.SetStateAction<string>>;
  figmaFileUrl: string;
  setFigmaFileUrl: React.Dispatch<React.SetStateAction<string>>;
  figmaStatus: "pending" | "checking" | "ok" | "error";
  setFigmaStatus: React.Dispatch<React.SetStateAction<"pending" | "checking" | "ok" | "error">>;
  pwUrl: string;
  setPwUrl: React.Dispatch<React.SetStateAction<string>>;
  pwWidth: number;
  setPwWidth: React.Dispatch<React.SetStateAction<number>>;
  pwHeight: number;
  setPwHeight: React.Dispatch<React.SetStateAction<number>>;
  pwStatus: "pending" | "checking" | "ok" | "error";
  setPwStatus: React.Dispatch<React.SetStateAction<"pending" | "checking" | "ok" | "error">>;
}

// ── Fallback presets (minimal shape for template loading) ─────
const BASE_OPEN_DESIGN_PRESETS_KEYS: Record<string, { label: string; tokens: string[]; donts: string[] }> = {
  figma: { label: "Figma tool UI", tokens: ["canvas surface", "selection blue"], donts: [] },
};

// ── Hook ──────────────────────────────────────────────────────

export function useWorkspace(
  basePresets: Record<string, OpenDesignDefinition>,
): UseWorkspaceReturn {
  // ── Workspace tab ───────────────────────────────────────────
  const [workspaceTab, setWorkspaceTab] = useState<"chat" | "code" | "checklist">("chat");

  // ── Project request / history ───────────────────────────────
  const defaultProject: ProjectRequest = {
    projectName: "Desygn AI Project",
    category: "SaaS",
    style: "Modern product UI",
    openDesign: "desygnAI",
    layout: "Design.md handoff workspace",
    target: "Codex + React",
    prompt: "",
  };

  const [request, setRequest] = useState<ProjectRequest>(defaultProject);
  const [generatedRequest, setGeneratedRequest] = useState<ProjectRequest | null>(null);
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => getProjectHistory());
  const [activeHistoryPrompt, setActiveHistoryPrompt] = useState(() => getProjectHistory()[0]?.prompt ?? "");
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Preview / generation ────────────────────────────────────
  const [previewMode, setPreviewMode] = useState<PreviewMode>("prompt");
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("light");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // ── Model ───────────────────────────────────────────────────
  const [groqModel, setGroqModel] = useState<string>(
    () => localStorage.getItem("desygn.model") ?? "llama-3.3-70b-versatile",
  );

  // ── Template state ──────────────────────────────────────────
  const [loadedTemplatePresets, setLoadedTemplatePresets] = useState<Record<string, OpenDesignDefinition>>({});
  const [landingTemplateQuery, setLandingTemplateQuery] = useState("");
  const [landingTemplatePriority, setLandingTemplatePriority] = useState<TemplatePriorityFilter>("All");
  const [landingTemplateCategory, setLandingTemplateCategory] = useState<TemplateCategoryFilter>("All");

  // ── Modals / popups ─────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatePopupOpen, setTemplatePopupOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupModalTab, setSetupModalTab] = useState(0);

  // ── Brand / settings ────────────────────────────────────────
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [brandHelpOpen, setBrandHelpOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "appearance" | "behavior" | "notifications" | "extensions" | "document" | "other">("profile");
  const [shareLinksEnabled, setShareLinksEnabled] = useState(() => localStorage.getItem("desygn.share-links") === "true");
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("desygn.display-name") ?? "");
  const [chatTheme, setChatTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("desygn.theme");
    return saved === "light" ? "light" : "dark";
  });

  // ── Integrations ────────────────────────────────────────────
  const [integrations, setIntegrations] = useState<IntegrationItem[]>(() => {
    try {
      const saved = localStorage.getItem("desygn.integrations");
      return saved
        ? (JSON.parse(saved) as IntegrationItem[])
        : [
            { id: "figma-mcp", name: "Figma MCP", icon: "figma", status: "disconnected" },
            { id: "github", name: "GitHub", icon: "github", status: "soon" },
            { id: "vercel", name: "Vercel Deploy", icon: "vercel", status: "soon" },
            { id: "notion", name: "Notion", icon: "notion", status: "soon" },
            { id: "linear", name: "Linear", icon: "linear", status: "soon" },
          ];
    } catch {
      return [];
    }
  });

  const saveIntegrations = useCallback((next: IntegrationItem[]) => {
    setIntegrations(next);
    localStorage.setItem("desygn.integrations", JSON.stringify(next));
  }, []);

  const [figmaMcpEndpoint, setFigmaMcpEndpoint] = useState(
    () => localStorage.getItem("desygn.figma-mcp-endpoint") ?? "",
  );
  const [chatMappingEnabled, setChatMappingEnabled] = useState(
    () => localStorage.getItem("desygn.chat-mapping") === "true",
  );

  // ── Checklist ───────────────────────────────────────────────
  const [checklistItems, setChecklistItems] = useState<ChecklistRow[]>(() => {
    try {
      const saved = localStorage.getItem("desygn.checklist-v3");
      return saved ? (JSON.parse(saved) as ChecklistRow[]) : DEFAULT_CHECKLIST_ROWS;
    } catch {
      return DEFAULT_CHECKLIST_ROWS;
    }
  });
  const [checklistSearch, setChecklistSearch] = useState("");
  const [checklistFilter, setChecklistFilter] = useState<"all" | "ui" | "ux" | "pass" | "fail" | "warn" | "untested">("all");
  const [checklistSourceFilter] = useState<"all" | DesignSource>("all");
  const [checklistCatFilter, setChecklistCatFilter] = useState("All");
  const [checklistPage, setChecklistPage] = useState(1);
  const [checklistPerPage, setChecklistPerPage] = useState(10);

  // ── Setup datasource ────────────────────────────────────────
  const [setupDatasource, setSetupDatasource] = useState<{
    type: string;
    url: string;
    sheet: string;
    headerRow: number;
  }>(() => {
    try {
      const s = localStorage.getItem("desygn.setup-datasource");
      return s
        ? (JSON.parse(s) as { type: string; url: string; sheet: string; headerRow: number })
        : { type: "excel", url: "", sheet: "", headerRow: 1 };
    } catch {
      return { type: "excel", url: "", sheet: "", headerRow: 1 };
    }
  });

  const [figmaToken, setFigmaToken] = useState("");
  const [figmaFileUrl, setFigmaFileUrl] = useState("");
  const [figmaStatus, setFigmaStatus] = useState<"pending" | "checking" | "ok" | "error">("pending");
  const [pwUrl, setPwUrl] = useState("");
  const [pwWidth, setPwWidth] = useState(1440);
  const [pwHeight, setPwHeight] = useState(900);
  const [pwStatus, setPwStatus] = useState<"pending" | "checking" | "ok" | "error">("pending");

  // ── Save project to history ─────────────────────────────────
  const saveGeneratedProject = useCallback(
    (requestToSave: ProjectRequest) => {
      const historyItem: ProjectHistoryItem = {
        name: requestToSave.projectName,
        date: new Date().toLocaleString("vi-VN"),
        prompt: requestToSave.prompt,
        category: requestToSave.category,
        openDesign: requestToSave.openDesign,
        target: requestToSave.target,
      };
      setActiveHistoryPrompt(historyItem.prompt);
      setProjectHistory((current) => {
        const nextHistory = [
          historyItem,
          ...current.filter((item) => item.prompt !== historyItem.prompt),
        ].slice(0, 12);
        saveProjectHistory(nextHistory);
        return nextHistory;
      });
    },
    [],
  );

  // ── Auto-load template presets on openDesign change ─────────
  useEffect(() => {
    const ids = [request.openDesign, generatedRequest?.openDesign].filter(
      (id): id is string => !!id && hasDesignMdTemplate(id),
    );
    if (ids.length === 0) return;

    let cancelled = false;
    ids.forEach((id) => {
      if (loadedTemplatePresets[id]) return;
      loadDesignMdTemplate(id)
        .then((template) => {
          if (!template || cancelled) return;
          const fallback =
            basePresets[template.id] ?? basePresets.figma ?? BASE_OPEN_DESIGN_PRESETS_KEYS.figma;
          const parsed = parseDesignMd(template.markdown, fallback as OpenDesignDefinition);
          setLoadedTemplatePresets((current) => ({
            ...current,
            [id]: {
              ...fallback,
              ...(parsed ?? {}),
              label: template.label,
              tokens: (fallback as OpenDesignDefinition).tokens,
              donts: parsed?.donts ?? (fallback as OpenDesignDefinition).donts,
            } as OpenDesignDefinition,
          }));
        })
        .catch(() => {
          /* template loading is non-critical */
        });
    });

    return () => {
      cancelled = true;
    };
  }, [basePresets, generatedRequest?.openDesign, loadedTemplatePresets, request.openDesign]);

  return {
    workspaceTab,
    setWorkspaceTab,
    request,
    setRequest,
    generatedRequest,
    setGeneratedRequest,
    projectHistory,
    setProjectHistory,
    activeHistoryPrompt,
    setActiveHistoryPrompt,
    isHistoryOpen,
    setIsHistoryOpen,
    saveGeneratedProject,
    sidebarCollapsed,
    setSidebarCollapsed,
    previewMode,
    setPreviewMode,
    previewTheme,
    setPreviewTheme,
    hasGenerated,
    setHasGenerated,
    copiedOutput,
    setCopiedOutput,
    groqModel,
    setGroqModel,
    loadedTemplatePresets,
    setLoadedTemplatePresets,
    landingTemplateQuery,
    setLandingTemplateQuery,
    landingTemplatePriority,
    setLandingTemplatePriority,
    landingTemplateCategory,
    setLandingTemplateCategory,
    settingsOpen,
    setSettingsOpen,
    templatePopupOpen,
    setTemplatePopupOpen,
    setupModalOpen,
    setSetupModalOpen,
    setupModalTab,
    setSetupModalTab,
    brandMenuOpen,
    setBrandMenuOpen,
    brandHelpOpen,
    setBrandHelpOpen,
    settingsTab,
    setSettingsTab,
    shareLinksEnabled,
    setShareLinksEnabled,
    displayName,
    setDisplayName,
    chatTheme,
    setChatTheme,
    integrations,
    setIntegrations,
    saveIntegrations,
    figmaMcpEndpoint,
    setFigmaMcpEndpoint,
    chatMappingEnabled,
    setChatMappingEnabled,
    checklistItems,
    setChecklistItems,
    checklistSearch,
    setChecklistSearch,
    checklistFilter,
    setChecklistFilter,
    checklistSourceFilter,
    checklistCatFilter,
    setChecklistCatFilter,
    checklistPage,
    setChecklistPage,
    checklistPerPage,
    setChecklistPerPage,
    setupDatasource,
    setSetupDatasource,
    figmaToken,
    setFigmaToken,
    figmaFileUrl,
    setFigmaFileUrl,
    figmaStatus,
    setFigmaStatus,
    pwUrl,
    setPwUrl,
    pwWidth,
    setPwWidth,
    pwHeight,
    setPwHeight,
    pwStatus,
    setPwStatus,
  };
}
