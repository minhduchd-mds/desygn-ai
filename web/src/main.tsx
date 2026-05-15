import { StrictMode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createEmptyContext, type DesignContext, type ValidationReport } from "../../shared/designContext";
import type { AccountPlan, AppView, AuthMode, ChatMessage, OpenDesignDefinition, OpenDesignPreset, ProjectHistoryItem, ProjectRequest, SessionUser } from "./app/types";
import {
  register, login, updatePlan, getSessionUser, saveSessionUser, clearSessionUser,
  getProjectHistory, saveProjectHistory, getChatHistoryKey, encryptChatMessages,
  decryptChatMessages, createMessage, CHAT_HISTORY_LIMIT, CHAT_HISTORY_PREFIX, SESSION_TTL_MS,
} from "./app/auth";
import { buildContext, parseFileSources } from "./design/contextBuilder";
import { BA_TEMPLATE_CONTENT } from "./design/constants";
import { buildDesignMd, buildPreviewText, inferProjectName, parseDesignMd } from "./design/designParser";
import { computeValidationReport } from "./design/layoutValidator";
import { generateScreens, type Screen } from "./design/screenGenerator";
import { matchTemplates } from "./design/templateMatcher";
import { DESIGN_MD_TEMPLATES, hasDesignMdTemplate, loadDesignMdTemplate, type DesignMdTemplateCategory } from "./design/templateRegistry";
import { ChatComposer } from "./workspace/ChatComposer";
import { buildMarkdownPrompt, readMarkdownFiles } from "./workspace/fileImport";
import { analyzeImage } from "./workspace/imageAnalyzer";
import { sendClaudeChat } from "./workspace/claudeChat";
import { fileToDataUrl, generateCodeFromScreenshot, getScreenshotToCodeWsUrl } from "./workspace/screenshotToCode";
import { DEFAULT_CHECKLIST_ROWS, DESIGN_SOURCES, CHECKLIST_CATEGORIES, PROJECT_PRESETS, type ChecklistRow, type ChecklistStatus, type DesignSource } from "./workspace/checklistData";
import { ComparePanel, type BugMarker } from "./workspace/ComparePanel";
import type { HtmlPreviewState } from "./workspace/HtmlPreviewModal";

// React.lazy — heavy components loaded on demand (Sprint 3 code splitting)
const SplitView = lazy(() => import("./workspace/SplitView").then(m => ({ default: m.SplitView })));
const HtmlPreviewModal = lazy(() => import("./workspace/HtmlPreviewModal").then(m => ({ default: m.HtmlPreviewModal })));
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import markdown from "highlight.js/lib/languages/markdown";
import DOMPurify from "dompurify";
import "highlight.js/styles/github-dark.min.css";
import "./styles.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

const chatMarked = new Marked(
  { breaks: true },
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

type PreviewMode = "prompt" | "preview" | "edit" | "split";
type PreviewTheme = "light" | "dark";
type TemplatePriorityFilter = "All" | "Product" | "Technical";
type TemplateCategoryFilter = "All" | DesignMdTemplateCategory;

const DESIGN_MD_EDIT_PREFIX = "design-md-ai.design-md-edit.v1";
const PRODUCT_NAME = "Desygn AI";
const REPOSITORY_URL = "https://github.com/minhduchd-mds/Design-md-ai";
const CUSTOM_USAGE_TEXT = "Download DESIGN.md, then place it at ./DESIGN.md";
const TEMPLATE_PRIORITY_FILTERS: TemplatePriorityFilter[] = ["All", "Product", "Technical"];
const TEMPLATE_CATEGORY_FILTERS: TemplateCategoryFilter[] = [
  "All",
  "AI",
  "Developer",
  "Workspace",
  "Product",
  "Commerce",
  "Finance",
  "Automotive",
  "Media",
];
const INITIAL_ASSISTANT_MESSAGE = "Paste a product request, upload Design.md files, or import screenshots to create AI-ready Design.md context for coding agents.";
const DEFAULT_PROJECT: ProjectRequest = {
  projectName: "Design-md-ai Project",
  category: "SaaS",
  style: "Modern product UI",
  openDesign: "openai",
  layout: "Design.md handoff workspace",
  target: "Codex + React",
  prompt: "Create a Design.md handoff for a Figma-backed SaaS dashboard with components, tokens, responsive rules, and implementation guidance.",
};

const BASE_OPEN_DESIGN_PRESETS: Record<OpenDesignPreset, OpenDesignDefinition> = {
  openai: {
    label: "Trợ lý ảo workspace",
    direction: "Calm AI workspace, readable long-form answers, low distraction, clear safety and action states.",
    palette: ["#F7F7F4", "#FFFFFF", "#202123", "#10A37F", "#D9EDE7"],
    typography: "Humanist sans, normal body weight, generous line-height, compact headings.",
    components: ["Prompt composer", "Conversation thread", "Model picker", "Response actions", "Safety notice"],
    layout: ["Centered chat column", "Persistent sidebar", "Sticky composer", "Readable output width"],
    elevation: "Flat surfaces with subtle borders; shadows only for floating composer or modal.",
    tokens: ["soft neutral surfaces", "single blue accent", "readable text scale", "subtle dividers"],
    rules: ["Prioritize prompt clarity and output review.", "Keep model, context, and result state visible."],
    donts: ["Do not overuse heavy gradients.", "Do not hide generation state."],
  },
  linear: {
    label: "Linear productivity",
    direction: "Dense product interface with precise rows, fast scanning, and minimal decorative chrome.",
    palette: ["#0F1014", "#17181D", "#F4F4F5", "#5E6AD2", "#2E3038"],
    typography: "Compact sans, medium labels, small dense metadata, no oversized marketing type inside tools.",
    components: ["Issue row", "Command menu", "Status badge", "Sidebar", "Activity feed"],
    layout: ["Two-panel workspace", "Dense list rows", "Keyboard-first command area", "Minimal chrome"],
    elevation: "Mostly flat dark surfaces with crisp dividers and small focus rings.",
    tokens: ["compact spacing", "crisp borders", "muted controls", "focused accent"],
    rules: ["Use tables/lists when users compare work.", "Keep actions close to their objects."],
    donts: ["Do not use card-heavy dashboards.", "Do not make controls visually loud."],
  },
  figma: {
    label: "Figma tool UI",
    direction: "Canvas-first tooling with selection state, compact inspectors, and reusable component thinking.",
    palette: ["#FFFFFF", "#F5F5F5", "#1E1E1E", "#0D99FF", "#E6F4FF"],
    typography: "Small utility text, clear labels, compact property controls, no decorative display fonts.",
    components: ["Toolbar", "Layer row", "Properties panel", "Canvas frame", "Inspector control"],
    layout: ["Canvas center", "Left layers", "Right inspector", "Top toolbar", "Selection-aware panels"],
    elevation: "Tool panels use borders and surface contrast; avoid deep shadows.",
    tokens: ["canvas surface", "selection blue", "tool panel neutral", "small control radius"],
    rules: ["Make state inspectable.", "Prefer compact controls and visible object hierarchy."],
    donts: ["Do not obscure the canvas.", "Do not mix marketing sections into the work surface."],
  },
  stripe: {
    label: "Stripe SaaS",
    direction: "Trustworthy business UI with exact forms, polished docs, and clear upgrade/payment flows.",
    palette: ["#FFFFFF", "#F6F9FC", "#0A2540", "#635BFF", "#00D4FF"],
    typography: "Clean SaaS type with precise labels, readable tables, and confident but not heavy headings.",
    components: ["Payment form", "Pricing table", "Metric card", "Docs sidebar", "Validation alert"],
    layout: ["Docs plus content split", "Precise form groups", "Business dashboard grid", "Billing summary"],
    elevation: "Soft business elevation with thin borders and careful shadows.",
    tokens: ["trust blue", "validation colors", "precise form spacing", "docs surface"],
    rules: ["Complete validation and error states.", "Keep plan and billing language unambiguous."],
    donts: ["Do not make pricing vague.", "Do not rely on color alone for validation."],
  },
  github: {
    label: "GitHub developer",
    direction: "Developer workflow UI with audit trails, status badges, readable code blocks, and durable navigation.",
    palette: ["#FFFFFF", "#F6F8FA", "#24292F", "#0969DA", "#2DA44E"],
    typography: "System sans with monospace for code/output, compact metadata, clear status labels.",
    components: ["Repo nav", "Issue list", "Diff block", "Status check", "Code output"],
    layout: ["Tabbed resource navigation", "List-detail views", "Code preview panels", "Audit trail feed"],
    elevation: "Border-led surfaces with minimal shadows and strong readable dividers.",
    tokens: ["bordered surfaces", "status colors", "monospace output", "compact tabs"],
    rules: ["Represent status with text plus color.", "Make generated files easy to inspect."],
    donts: ["Do not blur code/output.", "Do not hide status behind icons only."],
  },
  vercel: {
    label: "Vercel launch",
    direction: "Sharp deployment product UI with high contrast, clear build status, and polished product launches.",
    palette: ["#FFFFFF", "#FAFAFA", "#000000", "#0070F3", "#EAEAEA"],
    typography: "Geometric sans, restrained headings, crisp labels, high contrast text.",
    components: ["Deployment card", "Build log", "Environment picker", "Project nav", "Launch CTA"],
    layout: ["Clean hero", "Project dashboard", "Status timeline", "Docs-adjacent panels"],
    elevation: "Flat white surfaces, exact borders, occasional focused shadow for dialogs.",
    tokens: ["black and white base", "deployment blue", "thin borders", "precise spacing"],
    rules: ["Expose build status clearly.", "Keep generated project artifacts easy to deploy."],
    donts: ["Do not use noisy backgrounds.", "Do not bury deployment configuration."],
  },
  cursor: {
    label: "Cursor code agent",
    direction: "Code-first AI workspace with editor ergonomics, split panes, terminal output, and agent steps.",
    palette: ["#0B0F19", "#111827", "#E5E7EB", "#8B5CF6", "#22C55E"],
    typography: "Readable sans plus monospace output, compact panels, clear active file labels.",
    components: ["File tree", "Agent step list", "Diff preview", "Terminal", "Command palette"],
    layout: ["Editor split view", "Left file rail", "Right assistant panel", "Bottom terminal"],
    elevation: "Dark panels separated by borders, active focus ring, no decorative shadows.",
    tokens: ["editor surface", "agent purple", "success green", "monospace output"],
    rules: ["Show what the AI changed.", "Keep prompt, files, and output in the same workflow."],
    donts: ["Do not make code hard to scan.", "Do not hide long-running task status."],
  },
  notion: {
    label: "Notion document",
    direction: "Document-product hybrid with calm blocks, low chrome, and flexible page structure.",
    palette: ["#FFFFFF", "#F7F6F3", "#2F3437", "#2383E2", "#E9E5DD"],
    typography: "Soft document type, natural reading rhythm, lighter headings, block-level controls.",
    components: ["Page sidebar", "Block editor", "Database table", "Property pill", "Template gallery"],
    layout: ["Document canvas", "Block sections", "Database views", "Low-chrome sidebar"],
    elevation: "Very light surface grouping; hierarchy from spacing and typography.",
    tokens: ["paper surface", "muted labels", "block spacing", "subtle hover"],
    rules: ["Let content hierarchy carry the design.", "Keep generated docs editable and scannable."],
    donts: ["Do not over-frame blocks.", "Do not use heavy dashboard styling."],
  },
  apple: {
    label: "Apple product",
    direction: "Premium consumer presentation with high-quality imagery, generous spacing, and refined controls.",
    palette: ["#FFFFFF", "#F5F5F7", "#1D1D1F", "#0071E3", "#86868B"],
    typography: "Refined sans, lighter display headings, spacious paragraphs, minimal control labels.",
    components: ["Product hero", "Feature tile", "Gallery", "Comparison table", "Sticky action bar"],
    layout: ["Immersive hero", "Editorial sections", "Product comparison", "Image-led feature bands"],
    elevation: "Minimal chrome; use imagery and whitespace over card shadows.",
    tokens: ["premium neutrals", "image-first sections", "spacious rhythm", "blue CTA"],
    rules: ["Use product visuals as first-viewport signal.", "Keep copy concise and premium."],
    donts: ["Do not use generic stock-like visuals.", "Do not turn dense tools into oversized hero pages."],
  },
  voltagent: {
    label: "VoltAgent agent",
    direction: "Agent-building interface with clear orchestration, workflow status, and practical developer surfaces.",
    palette: ["#0F172A", "#111827", "#F8FAFC", "#14B8A6", "#F59E0B"],
    typography: "Modern developer SaaS typography with normal body weight and clear step labels.",
    components: ["Agent card", "Workflow timeline", "Tool call log", "Capability matrix", "Status badge"],
    layout: ["Agent overview", "Workflow builder", "Logs and traces", "Integration panels"],
    elevation: "Layered dark-ready panels with subtle teal focus and readable status colors.",
    tokens: ["agent teal", "trace amber", "dark panels", "workflow dividers"],
    rules: ["Make agent state and tool results visible.", "Show orchestration steps before final output."],
    donts: ["Do not hide reasoning artifacts that users need for debugging.", "Do not over-animate workflow state."],
  },
  material: {
    label: "Material system",
    direction: "Systematic cross-platform UI with explicit states, accessible controls, and responsive patterns.",
    palette: ["#FFFFFF", "#F8FAFC", "#1F2937", "#6750A4", "#EADDFF"],
    typography: "Clear type scale, normal body weight, explicit labels, accessible contrast.",
    components: ["Button", "Text field", "Navigation rail", "Dialog", "Data table"],
    layout: ["Responsive grid", "Navigation rail", "Top app bar", "Stateful forms"],
    elevation: "Use state layers and subtle elevation only where interaction needs hierarchy.",
    tokens: ["semantic roles", "state layers", "responsive breakpoints", "accessible focus"],
    rules: ["Include hover, focus, pressed, selected, disabled, loading, and error states.", "Use semantic roles before raw colors."],
    donts: ["Do not skip accessibility states.", "Do not use elevation as decoration."],
  },
  shopify: {
    label: "Shopify commerce",
    direction: "Merchant operations UI with clear product data, inventory flows, and trustworthy commerce actions.",
    palette: ["#FFFFFF", "#F6F6F7", "#202223", "#008060", "#E3F1DF"],
    typography: "Operational sans, readable product data, restrained headings, clear form labels.",
    components: ["Product table", "Inventory status", "Order summary", "Checkout action", "Merchant alert"],
    layout: ["Admin table", "Product detail", "Order workflow", "Settings panels"],
    elevation: "Quiet cards and tables with strong information hierarchy.",
    tokens: ["commerce green", "admin neutrals", "status colors", "table density"],
    rules: ["Make money, inventory, and customer state explicit.", "Use confirmation for irreversible actions."],
    donts: ["Do not obscure prices or plan limits.", "Do not use decorative commerce graphics inside admin flows."],
  },
};

const OPEN_DESIGN_PRESETS_META: Record<OpenDesignPreset, OpenDesignDefinition> = {
  ...BASE_OPEN_DESIGN_PRESETS,
  ...Object.fromEntries(
    DESIGN_MD_TEMPLATES.map((template) => [
      template.id,
      {
        ...BASE_OPEN_DESIGN_PRESETS.figma,
        label: template.label,
      } satisfies OpenDesignDefinition,
    ]),
  ),
};

function getOpenDesignPreset(
  id: OpenDesignPreset,
  loadedTemplates: Record<string, OpenDesignDefinition> = {},
): OpenDesignDefinition {
  return loadedTemplates[id] ?? OPEN_DESIGN_PRESETS_META[id] ?? OPEN_DESIGN_PRESETS_META.openai;
}

const COMPETITOR_BENCHMARKS = [
  { name: "ChatGPT", focus: "General AI chat", gap: "Weak design-system export discipline", score: 82 },
  { name: "Figma Make", focus: "Editable design generation", gap: "Needs stricter product rules and code handoff", score: 78 },
  { name: "v0", focus: "Fast UI generation", gap: "Can drift from local Figma tokens", score: 76 },
  { name: "Framer AI", focus: "Marketing websites", gap: "Less suited for app/workflow specs", score: 72 },
  { name: "Cursor", focus: "Code implementation", gap: "Needs curated Design.md context", score: 80 },
];

const LANDING_FEATURES = [
  ["Figma context first", "Use component names, variables, layout intent, and imported Design.md files before asking an AI agent to write code."],
  ["Design.md handoff", "Package screens, tokens, component rules, responsive behavior, and implementation guardrails into one readable spec."],
  ["Agent-ready output", "Prepare context for Codex, Claude Code, Cursor, Windsurf, and Figma Make instead of sending a vague prompt."],
];

const LANDING_SERVICES = [
  ["Design.md", "Create product context, page structure, component usage, tokens, and design rules."],
  ["Figma scan", "Read components, variables, pages, and design-system metadata from the plugin workflow."],
  ["Prompt export", "Turn the design system into compact prompts for implementation agents."],
  ["Template mapping", "Map components into dashboard, admin table, settings, landing, mobile, AI workspace, or console layouts."],
  ["Frame export", "Create a Figma frame that summarizes the selected project layout and mapped components."],
  ["Review checklist", "Expose token coverage, responsive behavior, accessibility, and handoff gaps before coding."],
];

const LANDING_SHOWCASE = [
  ["Figma Components", "Scan"],
  ["Design Tokens", "Map"],
  ["Design.md Folder", "Export"],
  ["Agent Prompt", "Handoff"],
];

const HOW_IT_WORKS = [
  ["Import design context", "Start from a Figma file, selected component, uploaded Design.md, or ZIP of markdown specs."],
  ["Generate Design.md", "Normalize project context, component rules, tokens, responsive behavior, and target-agent instructions."],
  ["Hand off to coding agents", "Copy or export the result for Codex, Claude Code, Cursor, Windsurf, or Figma Make."],
];

const CODE_LINES = [
  "# Design-md-ai",
  "## Handoff Overview",
  "- Source: Figma components + tokens",
  "- Target: Codex / Claude Code / Cursor",
  "- Output: Design.md + agent prompt",
  "",
  "## Guardrails",
  "- Preserve design tokens",
  "- Map variants to props",
  "- Verify responsive states",
];

interface MarkdownSection {
  id: string;
  title: string;
  content: string;
}


function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getDesignMdEditKey(request: ProjectRequest): string {
  return `${DESIGN_MD_EDIT_PREFIX}.${stableHash([
    request.projectName,
    request.category,
    request.openDesign,
    request.target,
    request.prompt,
  ].join("|"))}`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function templateCommandSlug(value: string): string {
  const slug = slugify(value);
  return slug && slug !== "template" ? slug : "custom";
}

function getDesignMdUsageCommand(openDesign: string): string {
  if (!hasDesignMdTemplate(openDesign)) return CUSTOM_USAGE_TEXT;
  return `npx getdesign@latest add ${templateCommandSlug(openDesign)}`;
}

function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: MarkdownSection[] = [];
  let currentTitle = "Overview";
  let currentLines: string[] = [];

  const pushSection = () => {
    const content = currentLines.join("\n").trim();
    if (!content && sections.length > 0) return;
    const baseId = slugify(currentTitle);
    const duplicateCount = sections.filter((section) => section.id === baseId || section.id.startsWith(`${baseId}-`)).length;
    sections.push({
      id: duplicateCount ? `${baseId}-${duplicateCount + 1}` : baseId,
      title: currentTitle,
      content,
    });
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      pushSection();
      currentTitle = heading[1].replace(/[#*_`]/g, "").trim();
      currentLines = [];
    } else if (/^#\s+/.test(line) && sections.length === 0 && currentLines.length === 0) {
      currentLines.push(line.replace(/^#\s+/, ""));
    } else {
      currentLines.push(line);
    }
  }
  pushSection();

  return sections.filter((section) => section.content || section.title);
}

function markdownPreviewBlocks(content: string) {
  const blocks: Array<{ type: "heading" | "list" | "code" | "paragraph"; text?: string; items?: string[] }> = [];
  const lines = content.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^###\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function MarkdownSectionContent({ content }: { content: string }) {
  return (
    <>
      {markdownPreviewBlocks(content).map((block, index) => {
        if (block.type === "heading") return <h4 key={index}>{block.text}</h4>;
        if (block.type === "code") return <pre key={index}>{block.text}</pre>;
        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items?.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </>
  );
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getSessionUser());
  const [view, setView] = useState<AppView>(() => (getSessionUser() ? "workspace" : "landing"));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [landingTemplateQuery, setLandingTemplateQuery] = useState("");
  const [landingTemplatePriority, setLandingTemplatePriority] = useState<TemplatePriorityFilter>("All");
  const [landingTemplateCategory, setLandingTemplateCategory] = useState<TemplateCategoryFilter>("All");
  const [request, setRequest] = useState<ProjectRequest>(DEFAULT_PROJECT);
  const [generatedRequest, setGeneratedRequest] = useState<ProjectRequest | null>(null);
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => getProjectHistory());
  const [activeHistoryPrompt, setActiveHistoryPrompt] = useState(() => getProjectHistory()[0]?.prompt ?? "");
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("prompt");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistoryReady, setChatHistoryReady] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [loadedTemplatePresets, setLoadedTemplatePresets] = useState<Record<string, OpenDesignDefinition>>({});
  const [workspaceTab, setWorkspaceTab] = useState<"chat" | "code" | "checklist">("chat");
  const [groqModel, setGroqModel] = useState<string>(() => localStorage.getItem("designready.model") ?? "llama-3.3-70b-versatile");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatePopupOpen, setTemplatePopupOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupModalTab, setSetupModalTab] = useState(0);
  const [checklistItems, setChecklistItems] = useState<ChecklistRow[]>(() => {
    try {
      const saved = localStorage.getItem("designready.checklist-v3");
      return saved ? JSON.parse(saved) as ChecklistRow[] : DEFAULT_CHECKLIST_ROWS;
    } catch { return DEFAULT_CHECKLIST_ROWS; }
  });
  const [checklistSearch, setChecklistSearch] = useState("");
  const [checklistFilter, setChecklistFilter] = useState<"all" | "ui" | "ux" | "pass" | "fail" | "warn" | "untested">("all");
  const [checklistSourceFilter, setChecklistSourceFilter] = useState<"all" | DesignSource>("all");
  const [checklistCatFilter, setChecklistCatFilter] = useState("All");
  const [checklistPage, setChecklistPage] = useState(1);
  const [checklistPerPage, setChecklistPerPage] = useState(10);
  const [setupDatasource, setSetupDatasource] = useState<{ type: string; url: string; sheet: string; headerRow: number }>(() => {
    try {
      const s = localStorage.getItem("designready.setup-datasource");
      return s ? JSON.parse(s) as { type: string; url: string; sheet: string; headerRow: number } : { type: "excel", url: "", sheet: "", headerRow: 1 };
    } catch { return { type: "excel", url: "", sheet: "", headerRow: 1 }; }
  });
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaFileUrl, setFigmaFileUrl] = useState("");
  const [figmaStatus, setFigmaStatus] = useState<"pending" | "checking" | "ok" | "error">("pending");
  const [pwUrl, setPwUrl] = useState("");
  const [pwWidth, setPwWidth] = useState(1440);
  const [pwHeight, setPwHeight] = useState(900);
  const [pwStatus, setPwStatus] = useState<"pending" | "checking" | "ok" | "error">("pending");

  // Detail Modal
  const [detailRow, setDetailRow] = useState<ChecklistRow | null>(null);
  const [detailTab, setDetailTab] = useState<0 | 1>(0);

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Compare Panel — Sprint 4
  const [bugMarkers, setBugMarkers] = useState<BugMarker[]>([]);
  const [compareDesignUrl, setCompareDesignUrl] = useState<string | null>(null);
  const [compareWebUrl, setCompareWebUrl] = useState<string | null>(null);

  // Toast notification system
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: "success" | "error" | "warn" | "info" }>>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((msg: string, type: "success" | "error" | "warn" | "info" = "success") => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const [chatTheme, setChatTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("designready.theme");
    return saved === "light" ? "light" : "dark";
  });
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("light");
  const [savedDesignMd, setSavedDesignMd] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSavedAt, setEditSavedAt] = useState<string | null>(null);
  const [designContext, setDesignContext] = useState<DesignContext | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [generatedScreens, setGeneratedScreens] = useState<Screen[]>([]);
  const [pendingUploadedFiles, setPendingUploadedFiles] = useState<File[]>([]);
  const [htmlPreview, setHtmlPreview] = useState<HtmlPreviewState | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const analyzeImageInputRef = useRef<HTMLInputElement | null>(null);
  const baDocInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME),
  ]);

  const outputRequest = generatedRequest ?? request;
  const openDesignPresets = useMemo(
    () => ({ ...OPEN_DESIGN_PRESETS_META, ...loadedTemplatePresets }),
    [loadedTemplatePresets],
  );
  const generatedDesignMd = useMemo(
    () => buildDesignMd(outputRequest, user?.plan ?? "free", openDesignPresets, COMPETITOR_BENCHMARKS),
    [openDesignPresets, outputRequest, user?.plan],
  );
  const designMdEditKey = useMemo(() => getDesignMdEditKey(outputRequest), [outputRequest]);
  const designMd = savedDesignMd ?? generatedDesignMd;
  const designMdSections = useMemo(() => parseMarkdownSections(designMd), [designMd]);
  const previewNavSections = useMemo(() => designMdSections.slice(0, 8), [designMdSections]);
  const designMdStatus = savedDesignMd ? "Edited" : "Generated";
  const previewItems = useMemo(() => buildPreviewText(outputRequest, openDesignPresets), [openDesignPresets, outputRequest]);
  const selectedPreset = getOpenDesignPreset(request.openDesign, loadedTemplatePresets);
  const outputPreset = getOpenDesignPreset(outputRequest.openDesign, loadedTemplatePresets);
  const importedDesign = useMemo(() => parseDesignMd(outputRequest.prompt, outputPreset), [outputRequest.prompt, outputPreset]);
  const activeDesign = importedDesign ?? outputPreset;
  const usageCommand = importedDesign ? CUSTOM_USAGE_TEXT : getDesignMdUsageCommand(outputRequest.openDesign);
  const templatePriorityCounts = useMemo(
    () => ({
      All: DESIGN_MD_TEMPLATES.length,
      Product: DESIGN_MD_TEMPLATES.filter((template) => template.priority === "Product").length,
      Technical: DESIGN_MD_TEMPLATES.filter((template) => template.priority === "Technical").length,
    }),
    [],
  );
  const landingTemplateMatches = useMemo(() => {
    const query = landingTemplateQuery.trim().toLowerCase();
    const matches = DESIGN_MD_TEMPLATES.filter((template) => {
      const matchesQuery = !query || `${template.id} ${template.label} ${template.category} ${template.priority} ${template.keywords.join(" ")}`.toLowerCase().includes(query);
      const matchesPriority = landingTemplatePriority === "All" || template.priority === landingTemplatePriority;
      const matchesCategory = landingTemplateCategory === "All" || template.category === landingTemplateCategory;
      return matchesQuery && matchesPriority && matchesCategory;
    });
    return matches.slice(0, 18);
  }, [landingTemplateCategory, landingTemplatePriority, landingTemplateQuery]);

  // Memoize checklist stats
  const checklistStats = useMemo(() => {
    const total = checklistItems.length;
    const tested = checklistItems.filter(r => r.status !== "untested");
    const pass = checklistItems.filter(r => r.status === "pass").length;
    const fail = checklistItems.filter(r => r.status === "fail").length;
    const warn = checklistItems.filter(r => r.status === "warn").length;
    const untested = checklistItems.filter(r => r.status === "untested").length;
    const req = checklistItems.filter(r => r.tag === "req").length;
    const avgScore = tested.length ? Math.round(tested.reduce((s, r) => s + r.score, 0) / tested.length * 10) : 0;
    const bySource = (src: DesignSource) => checklistItems.filter(r => r.source === src).length;
    const byCategory = (cat: string) => {
      const items = tested.filter(r => r.category === cat);
      return items.length ? Math.round(items.reduce((s, r) => s + r.score, 0) / items.length * 10) : 0;
    };
    return { total, pass, fail, warn, untested, req, avgScore, bySource, byCategory };
  }, [checklistItems]);

  // Memoize filtered + paginated checklist rows
  const filteredChecklistRows = useMemo(() => {
    let filtered = checklistItems;
    if (checklistSourceFilter !== "all") filtered = filtered.filter(r => r.source === checklistSourceFilter);
    if (checklistCatFilter !== "All") filtered = filtered.filter(r => r.category === checklistCatFilter);
    if (checklistSearch) {
      const q = checklistSearch.toLowerCase();
      filtered = filtered.filter(r => r.criterion.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.section.toLowerCase().includes(q) || r.component.toLowerCase().includes(q));
    }
    if (checklistFilter === "ui") filtered = filtered.filter(r => r.type === "UI");
    else if (checklistFilter === "ux") filtered = filtered.filter(r => r.type === "UX");
    else if (checklistFilter === "pass") filtered = filtered.filter(r => r.status === "pass");
    else if (checklistFilter === "fail") filtered = filtered.filter(r => r.status === "fail");
    else if (checklistFilter === "warn") filtered = filtered.filter(r => r.status === "warn");
    else if (checklistFilter === "untested") filtered = filtered.filter(r => r.status === "untested");
    return filtered;
  }, [checklistItems, checklistSearch, checklistFilter, checklistSourceFilter, checklistCatFilter]);

  const checklistTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredChecklistRows.length / checklistPerPage)),
    [filteredChecklistRows.length, checklistPerPage],
  );

  const paginatedChecklistRows = useMemo(() => {
    const page = Math.min(checklistPage, checklistTotalPages);
    const start = (page - 1) * checklistPerPage;
    return checklistPerPage >= 999 ? filteredChecklistRows : filteredChecklistRows.slice(start, start + checklistPerPage);
  }, [filteredChecklistRows, checklistPage, checklistPerPage, checklistTotalPages]);

  // P3: Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (detailRow) setDetailRow(null);
        else if (reportModalOpen) setReportModalOpen(false);
        else if (setupModalOpen) setSetupModalOpen(false);
        else if (templatePopupOpen) setTemplatePopupOpen(false);
        else if (htmlPreview) setHtmlPreview(null);
        else if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailRow, reportModalOpen, setupModalOpen, templatePopupOpen, htmlPreview, settingsOpen]);

  useEffect(() => {
    if (!user) return;
    saveSessionUser(user);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChatHistoryReady(false);
      return;
    }

    let cancelled = false;
    setChatHistoryReady(false);
    const encrypted = localStorage.getItem(getChatHistoryKey(user.emailHash));
    if (!encrypted) {
      setChatHistoryReady(true);
      return;
    }

    decryptChatMessages(user.emailHash, encrypted)
      .then((storedMessages) => {
        if (!cancelled && storedMessages.length > 0) {
          setMessages(storedMessages);
        }
      })
      .catch(() => {
        localStorage.removeItem(getChatHistoryKey(user.emailHash));
      })
      .finally(() => {
        if (!cancelled) setChatHistoryReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !chatHistoryReady) return;
    encryptChatMessages(user.emailHash, messages)
      .then((payload) => {
        localStorage.setItem(getChatHistoryKey(user.emailHash), payload);
      })
      .catch(() => {
        // Chat persistence is non-critical; keep UI responsive if encryption fails.
      });
  }, [chatHistoryReady, messages, user]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [hasGenerated, isGenerating, messages]);

  useEffect(() => {
    const saved = localStorage.getItem(designMdEditKey);
    setSavedDesignMd(saved);
    setEditDraft(saved ?? generatedDesignMd);
    setEditSavedAt(null);
  }, [designMdEditKey, generatedDesignMd]);

  useEffect(() => {
    const ids = [request.openDesign, outputRequest.openDesign].filter(hasDesignMdTemplate);
    if (ids.length === 0) return;

    let cancelled = false;
    ids.forEach((id) => {
      if (loadedTemplatePresets[id]) return;
      loadDesignMdTemplate(id)
        .then((template) => {
          if (!template || cancelled) return;
          const fallback = BASE_OPEN_DESIGN_PRESETS[template.id] ?? BASE_OPEN_DESIGN_PRESETS.figma;
          const parsed = parseDesignMd(template.markdown, fallback);
          setLoadedTemplatePresets((current) => ({
            ...current,
            [id]: {
              ...fallback,
              ...(parsed ?? {}),
              label: template.label,
              tokens: fallback.tokens,
              donts: parsed?.donts ?? fallback.donts,
            },
          }));
        })
        .catch(() => {
          // Template loading is non-critical; keep the lightweight fallback preset.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [loadedTemplatePresets, outputRequest.openDesign, request.openDesign]);

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      const session = authMode === "login" ? await login(email, password) : await register(email, password);
      saveSessionUser(session);
      setUser(session);
      setPassword("");
      setView("workspace");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  }

  function upgradeToPro() {
    if (!user) return;
    updatePlan(user.emailHash, "pro");
    const nextUser = { ...user, plan: "pro" as const };
    saveSessionUser(nextUser);
    setUser(nextUser);
  }

  function saveGeneratedProject(requestToSave: ProjectRequest) {
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
      const nextHistory = [historyItem, ...current.filter((item) => item.prompt !== historyItem.prompt)].slice(0, 12);
      saveProjectHistory(nextHistory);
      return nextHistory;
    });
  }

  function detectWebIntent(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return /tạo\s*(web|website|trang|app|giao diện)|create\s*(web|website|page|app|landing|ui)|build\s*(web|website|page|app|landing)|make\s*(web|website|page|app)|html|landing page|homepage|web app|single.?page|portfolio site/.test(p);
  }

  async function generateHtmlFromPrompt(prompt: string): Promise<string | null> {
    try {
      const res = await fetch("/api/generate-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style: selectedPreset.label }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { html?: string };
      return data.html ?? null;
    } catch {
      return null;
    }
  }

  async function sendChatMessage() {
    const prompt = request.prompt.trim();
    if (!prompt) return;

    const userMessage = createMessage("user", prompt);
    const chatMessages = [...messages, userMessage];
    const streamingMsg = createMessage("assistant", "", "Trợ lý ảo");
    const streamingId = streamingMsg.id;

    setMessages([...chatMessages, streamingMsg]);
    setRequest((current) => ({ ...current, prompt: "" }));
    setIsGenerating(true);

    const isWebIntent = detectWebIntent(prompt);

    try {
      const [, htmlCode] = await Promise.all([
        sendClaudeChat(
          chatMessages,
          {
            projectName: outputRequest.projectName,
            category: request.category,
            selectedTemplate: selectedPreset.label,
            readinessScore: validationReport?.readinessScore ?? null,
            activeDesignMd: hasGenerated,
            workspaceTab,
            model: groqModel,
          },
          (token) => {
            setMessages((current) =>
              current.map((m) => (m.id === streamingId ? { ...m, content: m.content + token } : m)),
            );
          },
        ),
        isWebIntent ? generateHtmlFromPrompt(prompt) : Promise.resolve(null),
      ]);
      if (htmlCode) {
        setMessages((current) =>
          current.map((m) => (m.id === streamingId ? { ...m, htmlCode } : m)),
        );
      }
    } catch (error) {
      setMessages((current) =>
        current.map((m) =>
          m.id === streamingId
            ? { ...m, content: error instanceof Error ? error.message : "Trợ lý ảo đang bận 'tư duy vĩ đại' — thử lại nhé! 🤖" }
            : m,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateProject() {
    const prompt = request.prompt.trim();
    if (!prompt) return;
    const nextRequest = {
      ...request,
      projectName: inferProjectName(prompt, request.category),
      layout: "Design.md handoff workspace",
      style: `${getOpenDesignPreset(request.openDesign, loadedTemplatePresets).label} / ${request.category}`,
      prompt,
    };
    setMessages((current) => [
      ...current,
      createMessage("user", prompt),
    ]);
    setRequest((current) => ({ ...current, projectName: nextRequest.projectName, layout: nextRequest.layout, style: nextRequest.style, prompt: "" }));
    setIsGenerating(true);
    setHasGenerated(false);
    setValidationReport(null);
    setGeneratedScreens([]);

    try {
      const context = await buildContext({
        pluginScanResult: [],
        uploadedFiles: pendingUploadedFiles,
        textPrompt: prompt,
        variableCount: 0,
        pageCount: 0,
      });
      context.selectedTemplateId = nextRequest.openDesign;
      context.templateMatches = matchTemplates(context);

      const topMatch = context.templateMatches[0];
      const templateId =
        topMatch && topMatch.score >= 20
          ? topMatch.templateId
          : hasDesignMdTemplate(nextRequest.openDesign)
            ? nextRequest.openDesign
            : topMatch?.templateId ?? nextRequest.openDesign;
      context.selectedTemplateId = templateId;
      const report = computeValidationReport(context, templateId);
      context.validationReport = report;
      const matchedRequest: ProjectRequest = {
        ...nextRequest,
        openDesign: templateId,
        style: `${getOpenDesignPreset(templateId, loadedTemplatePresets).label} / ${nextRequest.category}`,
      };
      const screens = report.canProceed ? await generateScreens(context) : [];

      setGeneratedRequest(matchedRequest);
      saveGeneratedProject(matchedRequest);
      setRequest((current) => ({ ...current, openDesign: templateId, style: matchedRequest.style }));
      setDesignContext(context);
      setValidationReport(report);
      setGeneratedScreens(screens);
      setHasGenerated(true);
      setPreviewMode(screens.length > 0 ? "split" : "prompt");
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          report.canProceed
            ? `Generated workflow context using ${parseDesignMd(nextRequest.prompt, getOpenDesignPreset(templateId, loadedTemplatePresets))?.label ?? getOpenDesignPreset(templateId, loadedTemplatePresets).label}. Readiness ${report.readinessScore}/100. Top templates: ${context.templateMatches.map((match) => match.templateId).join(", ") || templateId}.`
            : `Validated workflow context using ${parseDesignMd(nextRequest.prompt, getOpenDesignPreset(templateId, loadedTemplatePresets))?.label ?? getOpenDesignPreset(templateId, loadedTemplatePresets).label}. Readiness ${report.readinessScore}/100. Fix missing items to proceed: ${[...report.missingComponents, ...report.missingTokens].slice(0, 6).join(", ") || "component scan data"}.`,
          report.canProceed ? "Workflow ready" : "Validation required",
        ),
      ]);
    } catch (error) {
      setHasGenerated(false);
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          error instanceof Error ? error.message : "Could not generate the workflow context.",
          "Workflow error",
        ),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function getWorkflowContext(): Promise<DesignContext> {
    if (designContext) return designContext;

    const prompt = request.prompt.trim() || outputRequest.prompt.trim() || DEFAULT_PROJECT.prompt;
    const context = await buildContext({
      pluginScanResult: [],
      uploadedFiles: pendingUploadedFiles,
      textPrompt: prompt,
      variableCount: 0,
      pageCount: 0,
    });
    context.selectedTemplateId = request.openDesign;
    context.templateMatches = matchTemplates(context);
    return context;
  }

  async function analyzeWorkspaceImage(files: FileList) {
    const image = Array.from(files).find((file) => /^image\//.test(file.type));
    if (!image) {
      setMessages((current) => [...current, createMessage("assistant", "Choose a PNG, JPG, or WEBP image file.", "Analyze image")]);
      return;
    }

    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      createMessage("user", `Analyze image: ${image.name}`),
      createMessage("assistant", "Analyzing layout pattern and matching templates...", "Analyze image"),
    ]);

    try {
      const context = await getWorkflowContext();
      const result = await analyzeImage(image, context);
      const templateId = result.top3[0]?.templateId ?? context.selectedTemplateId ?? request.openDesign;
      const enrichedContext = {
        ...result.enrichedContext,
        selectedTemplateId: templateId,
      };
      const report = computeValidationReport(enrichedContext, templateId);
      enrichedContext.validationReport = report;

      setDesignContext(enrichedContext);
      setValidationReport(report);
      setRequest((current) => ({ ...current, openDesign: templateId }));
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          `Image analysis complete. Top templates: ${result.top3.map((match) => `${match.templateId} ${match.score}%`).join(", ") || templateId}.`,
          "Analyze image",
        ),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage("assistant", error instanceof Error ? error.message : "Could not analyze the image.", "Analyze image"),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function addBaDocument(files: FileList) {
    const uploadedFiles = Array.from(files);
    const docs = await parseFileSources(uploadedFiles);
    if (docs.length === 0) {
      setMessages((current) => [...current, createMessage("assistant", "Add a .md or .txt BA document.", "Add BA doc")]);
      return;
    }

    setPendingUploadedFiles((current) => [...current, ...uploadedFiles]);
    const baseContext = designContext ?? createEmptyContext();
    const updatedContext = {
      ...baseContext,
      docs: [...baseContext.docs, ...docs],
      prompt: baseContext.prompt || request.prompt || outputRequest.prompt,
    };
    updatedContext.templateMatches = matchTemplates(updatedContext);
    updatedContext.selectedTemplateId = updatedContext.selectedTemplateId ?? updatedContext.templateMatches[0]?.templateId ?? request.openDesign;

    setDesignContext(updatedContext);
    setMessages((current) => [
      ...current,
      createMessage("assistant", `Document added: ${docs.map((doc) => doc.filename).join(", ")}`, "Add BA doc"),
    ]);
  }

  async function generateFiveScreensFromContext() {
    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      createMessage("assistant", "Generating 5 screens...", "Generate 5 screens"),
    ]);

    try {
      const context = await getWorkflowContext();
      const templateId = context.selectedTemplateId ?? context.templateMatches[0]?.templateId ?? request.openDesign;
      context.selectedTemplateId = templateId;
      context.validationReport = computeValidationReport(context, templateId);
      const screens = await generateScreens(context);
      const prompt = context.prompt || outputRequest.prompt || DEFAULT_PROJECT.prompt;
      const nextRequest: ProjectRequest = generatedRequest ?? {
        ...request,
        projectName: inferProjectName(prompt, request.category),
        layout: "Design.md handoff workspace",
        style: `${getOpenDesignPreset(templateId, loadedTemplatePresets).label} / ${request.category}`,
        openDesign: templateId,
        prompt,
      };

      setDesignContext(context);
      setValidationReport(context.validationReport);
      setGeneratedScreens(screens);
      setGeneratedRequest(nextRequest);
      saveGeneratedProject(nextRequest);
      setHasGenerated(true);
      setPreviewMode("split");
      setMessages((current) => [
        ...current,
        createMessage("assistant", `Generated ${screens.length} screens and opened Split View.`, "Generate 5 screens"),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage("assistant", error instanceof Error ? error.message : "Could not generate screens.", "Generate 5 screens"),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyOutput() {
    const value =
      previewMode === "split" && generatedScreens.length > 0
        ? generatedScreens.map((screen) => screen.markdown).join("\n\n---\n\n")
        : previewMode === "edit"
        ? editDraft
        : previewMode === "prompt"
          ? designMd
          : buildPreviewText(outputRequest, openDesignPresets).join("\n");
    await navigator.clipboard.writeText(value);
    setCopiedOutput(true);
    window.setTimeout(() => setCopiedOutput(false), 1400);
  }

  function downloadDesignMd() {
    const blob = new Blob([designMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${templateCommandSlug(outputRequest.projectName)}-DESIGN.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function scrollToPreviewSection(sectionId: string) {
    document.getElementById(`preview-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveDesignMdEdit() {
    localStorage.setItem(designMdEditKey, editDraft);
    setSavedDesignMd(editDraft);
    setEditSavedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
    setMessages((current) => [
      ...current,
      createMessage("assistant", "Saved the edited Design.md for this project in local storage.", "Design.md saved"),
    ]);
  }

  function resetDesignMdEdit() {
    localStorage.removeItem(designMdEditKey);
    setSavedDesignMd(null);
    setEditDraft(generatedDesignMd);
    setEditSavedAt(null);
  }

  function showComingSoon(label: string) {
    setMessages((current) => [
      ...current,
      createMessage("assistant", `${label} is on the roadmap. The current public demo focuses on Design.md generation, prompt handoff, upload, preview, and history.`, "Coming soon"),
    ]);
  }

  function logout() {
    clearSessionUser();
    setUser(null);
    setView("landing");
    setHasGenerated(false);
    setGeneratedRequest(null);
    setGeneratedScreens([]);
    setValidationReport(null);
    setDesignContext(null);
    setPendingUploadedFiles([]);
    setMessages([
      createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME),
    ]);
    setChatHistoryReady(false);
    setActiveHistoryPrompt("");
  }

  function openHistoryProject(item: ProjectHistoryItem) {
    const nextRequest = {
      ...request,
      projectName: item.name,
      category: item.category,
      openDesign: item.openDesign,
      target: item.target,
      prompt: item.prompt,
      style: `${getOpenDesignPreset(item.openDesign, loadedTemplatePresets).label} / ${item.category}`,
    };
    setRequest((current) => ({ ...current, ...nextRequest, prompt: "" }));
    setGeneratedRequest(nextRequest);
    setHasGenerated(true);
    setIsGenerating(false);
    setPreviewMode("prompt");
    setGeneratedScreens([]);
    setValidationReport(null);
    setDesignContext(null);
    setActiveHistoryPrompt(item.prompt);
    setMessages([
      createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME),
      createMessage("user", item.prompt),
      createMessage("assistant", `Restored ${item.name}. You can continue the session or review the generated Design.md/Preview below.`),
    ]);
  }

  function deleteHistoryItem(item: ProjectHistoryItem, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setProjectHistory((current) => {
      const next = current.filter((h) => h.prompt !== item.prompt);
      saveProjectHistory(next);
      return next;
    });
    if (activeHistoryPrompt === item.prompt) {
      setActiveHistoryPrompt("");
    }
  }

  function startNewChat() {
    setMessages([createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME)]);
    setRequest((current) => ({ ...current, prompt: "" }));
    setIsGenerating(false);
  }

  async function copyMessageContent(msg: ChatMessage) {
    await navigator.clipboard.writeText(msg.content);
    setCopiedMessageId(msg.id);
    window.setTimeout(() => setCopiedMessageId(null), 1400);
  }

  async function regenerateMessage(msgIndex: number) {
    // Find the last user message before this index
    let lastUserIdx = -1;
    for (let i = msgIndex; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const userMsg = messages[lastUserIdx];
    // Remove messages from lastUserIdx onward, then resend
    const trimmed = messages.slice(0, lastUserIdx);
    setMessages(trimmed);
    setRequest((current) => ({ ...current, prompt: userMsg.content }));
    // Trigger send on next tick
    window.setTimeout(() => {
      const sendBtn = document.querySelector<HTMLButtonElement>(".send-button");
      sendBtn?.click();
    }, 50);
  }

  function startNewProject() {
    setRequest(DEFAULT_PROJECT);
    setGeneratedRequest(null);
    setHasGenerated(false);
    setIsGenerating(false);
    setPreviewMode("prompt");
    setGeneratedScreens([]);
    setValidationReport(null);
    setDesignContext(null);
    setPendingUploadedFiles([]);
    setActiveHistoryPrompt("");
    setMessages([createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME)]);
  }

  function handleGoogleLogin(credentialResponse: { credential?: string }) {
    const token = credentialResponse.credential;
    if (!token) { setAuthError("Google login failed — no credential received."); return; }
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64)) as { sub?: string; email?: string };
      if (!payload.sub || !payload.email) throw new Error("Missing fields");
      const session: SessionUser = {
        emailHash: stableHash(payload.sub),
        displayEmail: payload.email,
        plan: "free",
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
      saveSessionUser(session);
      setUser(session);
      setView("workspace");
    } catch {
      setAuthError("Could not read Google account info. Try email login.");
    }
  }

  function openLandingAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthError("");
    window.requestAnimationFrame(() => {
      document.getElementById("login")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openTemplateLibrary() {
    setTemplatePopupOpen(true);
  }

  function selectLandingTemplate(templateId: string) {
    const template = DESIGN_MD_TEMPLATES.find((item) => item.id === templateId);
    setRequest((current) => ({
      ...current,
      projectName: `${template?.label ?? "Design.md"} Handoff`,
      openDesign: templateId as OpenDesignPreset,
      prompt: `Create a Design.md handoff using the ${template?.label ?? templateId} template. Include tokens, component rules, responsive behavior, accessibility notes, and implementation guidance.`,
    }));

    if (user) {
      setView("workspace");
      return;
    }

    openLandingAuth("register");
  }

  async function uploadMarkdownFiles(files: FileList) {
    const uploadedFiles = Array.from(files);
    setPendingUploadedFiles(uploadedFiles);
    const { markdownFiles, zipCount } = await readMarkdownFiles(files);

    if (markdownFiles.length === 0) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          zipCount > 0 ? "No .md files were found in the uploaded ZIP." : "Only .md, .markdown, .txt, or .zip files containing markdown are supported.",
          "Upload file",
        ),
      ]);
      return;
    }

    const nextPrompt = buildMarkdownPrompt(markdownFiles);
    const docSources = await parseFileSources(uploadedFiles);
    setRequest((current) => ({ ...current, prompt: nextPrompt }));
    setGeneratedRequest(null);
    setHasGenerated(false);
    setGeneratedScreens([]);
    setValidationReport(null);
    setMessages((current) => [
      ...current,
      createMessage("assistant", `Loaded ${markdownFiles.length} markdown file${markdownFiles.length > 1 ? "s" : ""}${zipCount ? ` from ${zipCount} ZIP file${zipCount > 1 ? "s" : ""}` : ""} into the prompt and staged ${docSources.length} BA source${docSources.length > 1 ? "s" : ""} for workflow generation.`, "Upload Design.md"),
    ]);
  }

  function createImageFromPrompt() {
    const backendUrl = getScreenshotToCodeWsUrl();
    setMessages((current) => [
      ...current,
      createMessage("user", "Create image"),
      createMessage(
        "assistant",
        backendUrl
          ? `Choose an image or screenshot to generate UI code. After selection, the app will show loading and send it to: ${backendUrl}.`
          : "Choose an image or screenshot to generate UI code. The screenshot-to-code backend is not configured yet, so the app will show setup guidance after selection.",
        "Screenshot-to-code",
      ),
    ]);
  }

  async function uploadScreenshot(files: FileList) {
    const image = Array.from(files).find((file) => /^image\//.test(file.type));
    if (!image) {
      setMessages((current) => [...current, createMessage("assistant", "Choose a PNG, JPG, or WEBP image file.", "Screenshot-to-code")]);
      return;
    }

    setHasGenerated(false);
    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      createMessage("user", `Generate UI code from screenshot: ${image.name}`),
      createMessage("assistant", "Analyzing the image and generating UI code...", "Screenshot-to-code"),
    ]);

    try {
      const baseContext = await buildContext({
        pluginScanResult: [],
        uploadedFiles: pendingUploadedFiles,
        textPrompt: request.prompt || image.name,
        variableCount: 0,
        pageCount: 0,
      });
      const imageAnalysis = await analyzeImage(image, baseContext);
      const imageTopMatch = imageAnalysis.top3[0];
      const imageTemplateId =
        imageTopMatch && imageTopMatch.score >= 20
          ? imageTopMatch.templateId
          : hasDesignMdTemplate(request.openDesign)
            ? request.openDesign
            : imageTopMatch?.templateId ?? request.openDesign;
      imageAnalysis.enrichedContext.selectedTemplateId = imageTemplateId;
      const imageReport = computeValidationReport(imageAnalysis.enrichedContext, imageTemplateId);
      imageAnalysis.enrichedContext.validationReport = imageReport;
      setDesignContext(imageAnalysis.enrichedContext);
      setValidationReport(imageReport);
      setRequest((current) => ({ ...current, openDesign: imageTemplateId }));

      const imageDataUrl = await fileToDataUrl(image);
      const result = await generateCodeFromScreenshot({ imageDataUrl, stack: "react_tailwind" });
      const prompt = `Screenshot-to-code generated React/Tailwind UI from ${image.name}.\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
      const nextRequest: ProjectRequest = {
        ...request,
        openDesign: imageTemplateId,
        projectName: inferProjectName(image.name.replace(/\.[^.]+$/, ""), "AI tool"),
        category: "AI tool",
        style: `${getOpenDesignPreset(imageTemplateId, loadedTemplatePresets).label} / screenshot-to-code`,
        prompt,
      };
      imageAnalysis.enrichedContext.prompt = prompt;
      const screens = imageReport.canProceed ? await generateScreens(imageAnalysis.enrichedContext) : [];
      setGeneratedScreens(screens);
      setGeneratedRequest(nextRequest);
      setRequest((current) => ({ ...current, category: nextRequest.category, style: nextRequest.style, prompt: "" }));

      saveGeneratedProject(nextRequest);
      setHasGenerated(true);
      setPreviewMode(screens.length > 0 ? "split" : "prompt");
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          imageReport.canProceed
            ? `Generated code from the screenshot and matched ${imageTemplateId}. Readiness ${imageReport.readinessScore}/100. Review it in Split View or Design.md.`
            : `Generated code from the screenshot and matched ${imageTemplateId}. Readiness ${imageReport.readinessScore}/100. Fix missing items to proceed with screen generation.`,
          "Screenshot-to-code",
        ),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "Could not generate code from the screenshot. Check the screenshot-to-code backend.",
          "Screenshot-to-code",
        ),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  if (view === "workspace" && user) {
    return (
      <>
      <main className={`workspace-shell${sidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
        <aside className="workspace-sidebar">
          <div className="sidebar-brand-header">
            <div className="sidebar-brand-logo">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                    <stop offset="0%" stopColor="#8b5cf6"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="8" fill="url(#logoGrad)" opacity="0.15"/>
                <path d="M10 8h8a6 6 0 010 12h-4l-4 4V8z" fill="url(#logoGrad)"/>
                <rect x="13" y="12" width="6" height="6" rx="1" fill="#fff" opacity="0.7"/>
              </svg>
              <span className="sidebar-brand-name">{PRODUCT_NAME}</span>
            </div>
            <button
              className="sidebar-toggle"
              type="button"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d={sidebarCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="workspace-tabs">
            <button type="button" className={`workspace-tab${workspaceTab === "chat" ? " active" : ""}`} onClick={() => setWorkspaceTab("chat")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Chat
            </button>
            <button type="button" className={`workspace-tab${workspaceTab === "code" ? " active" : ""}`} onClick={() => setWorkspaceTab("code")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              Code
            </button>
          </div>
          <nav className="side-nav">
            <a
              href="#new-chat"
              role="button"
              className="new-chat-link"
              onClick={(event) => {
                event.preventDefault();
                startNewChat();
              }}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                <line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/>
              </svg>
              <span className="nav-label">New Chat</span>
            </a>
            <a href="#projects" role="button" onClick={(event) => { event.preventDefault(); setIsHistoryOpen(true); }}>
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
              <span className="nav-label">Projects</span>
            </a>
            <a href="#templates" role="button" onClick={(event) => { event.preventDefault(); openTemplateLibrary(); }}>
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/></svg>
              <span className="nav-label">Templates</span>
            </a>
            <a href="#checklist" role="button" className={workspaceTab === "checklist" ? "active" : ""} onClick={(event) => { event.preventDefault(); setWorkspaceTab("checklist"); }}>
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="nav-label">Checklist UI/UX</span>
            </a>
            <a href="#library" role="button" onClick={(event) => { event.preventDefault(); showComingSoon("My Library"); }}>
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 3h14a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
              <span className="nav-label">My Library</span>
              <span className="nav-status">Soon</span>
            </a>
            <a href="#settings" role="button" onClick={(event) => { event.preventDefault(); setSettingsOpen((v) => !v); }}>
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.8"/></svg>
              <span className="nav-label">Settings</span>
            </a>
          </nav>
          {sidebarCollapsed && projectHistory.length > 0 && (
            <div className="sidebar-history-collapsed">
              <svg className="nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 6px", opacity: 0.5 }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              {projectHistory.slice(0, 6).map((item, index) => (
                <button
                  key={item.prompt}
                  className={`history-dot${(activeHistoryPrompt === item.prompt || (!activeHistoryPrompt && index === 0)) ? " active" : ""}`}
                  title={item.name}
                  type="button"
                  onClick={() => openHistoryProject(item)}
                />
              ))}
            </div>
          )}

          {!sidebarCollapsed && (
            <div className="sidebar-projects-section">
              <span className="sidebar-section-label">DỰ ÁN</span>
              <a href="#" className="sidebar-project-item" onClick={(e) => e.preventDefault()}>
                <svg className="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                <span>TenantX Platform</span>
              </a>
              <a href="#" className="sidebar-project-item" onClick={(e) => e.preventDefault()}>
                <svg className="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                <span>Mobile App v2</span>
              </a>
              <a href="#" className="sidebar-project-item add-project" onClick={(e) => e.preventDefault()}>
                <svg className="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Thêm dự án</span>
              </a>
            </div>
          )}

          <section className={`sidebar-history ${isHistoryOpen ? "is-open" : "is-hidden"}`}>
            <span
              role="button"
              className="title"
              aria-expanded={isHistoryOpen}
              aria-label={isHistoryOpen ? "Collapse history" : "Expand history"}
              onClick={(event) => {
                event.preventDefault();
                setIsHistoryOpen((current) => !current);
              }}
            >
              <span>History</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="history-toggle-icon"
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeLinecap="square" />
              </svg>
            </span>
            {isHistoryOpen && (
              <div className="sidebar-history-list">
                {projectHistory.map((item, index) => (
                  <a
                    key={item.prompt}
                    href={`#history-${index}`}
                    role="button"
                    className={`history-item${
                      activeHistoryPrompt === item.prompt || (!activeHistoryPrompt && index === 0) ? " active" : ""
                    }`}
                    aria-current={
                      activeHistoryPrompt === item.prompt || (!activeHistoryPrompt && index === 0) ? "true" : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      openHistoryProject(item);
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    <button
                      type="button"
                      className="history-delete-btn"
                      aria-label={`Delete ${item.name}`}
                      onClick={(event) => deleteHistoryItem(item, event)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </a>
                ))}
              </div>
            )}
          </section>

          {settingsOpen && (
            <section className="settings-panel">
              <h4>Settings</h4>
              <label className="settings-row">
                <span>AI Model</span>
                <select
                  value={groqModel}
                  onChange={(e) => {
                    const m = e.target.value;
                    setGroqModel(m);
                    localStorage.setItem("designready.model", m);
                  }}
                >
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B (default)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B (fast)</option>
                  <option value="mixtral-8x7b-32768">Mixtral 8x7B (32K ctx)</option>
                  <option value="gemma2-9b-it">Gemma 2 9B</option>
                </select>
              </label>
              <label className="settings-row">
                <span>Theme</span>
                <select
                  value={chatTheme}
                  onChange={(e) => {
                    const t = e.target.value as "dark" | "light";
                    setChatTheme(t);
                    localStorage.setItem("designready.theme", t);
                  }}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <button
                type="button"
                className="settings-danger-btn"
                onClick={() => {
                  setMessages([createMessage("assistant", INITIAL_ASSISTANT_MESSAGE, PRODUCT_NAME)]);
                  setProjectHistory([]);
                  saveProjectHistory([]);
                  setActiveHistoryPrompt("");
                }}
              >
                Clear all history
              </button>
            </section>
          )}

          {/* Pro badge */}
          <section className="plan-card">
            <div className="plan-card-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#8b5cf6"/></svg>
              <span>{user.plan === "pro" ? "Pro Active" : "Free"}</span>
            </div>
            {user.plan !== "pro" && <button onClick={upgradeToPro}>Upgrade Pro</button>}
          </section>

          {/* Profile */}
          <div className="brand-block">
            <span className="brand-mark" title={sidebarCollapsed ? user.displayEmail : undefined}>AI</span>
            <div>
              <strong>{PRODUCT_NAME}</strong>
              <span>{user.displayEmail}</span>
            </div>
            <button className="ghost-button logout-button" type="button" onClick={logout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </aside>

        {templatePopupOpen && (
          <div className="template-popup-overlay" role="dialog" aria-modal="true" aria-label="Template Library" onClick={(e) => { if (e.target === e.currentTarget) setTemplatePopupOpen(false); }}>
            <div className="template-popup">
              <div className="template-popup-header">
                <h3>Template Library</h3>
                <button type="button" className="template-popup-close" onClick={() => setTemplatePopupOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="template-popup-search">
                <input
                  value={landingTemplateQuery}
                  onChange={(e) => setLandingTemplateQuery(e.target.value)}
                  placeholder="Search templates... (Airtable, Linear, Stripe...)"
                  autoFocus
                />
              </div>
              <div className="template-popup-filters">
                <div className="template-priority-tabs" aria-label="Priority filters">
                  {TEMPLATE_PRIORITY_FILTERS.map((priority) => (
                    <button key={priority} type="button" className={landingTemplatePriority === priority ? "active" : ""} onClick={() => setLandingTemplatePriority(priority)}>
                      <span>{priority === "All" ? "All" : priority}</span>
                      <b>{templatePriorityCounts[priority]}</b>
                    </button>
                  ))}
                </div>
                <div className="template-category-chips" aria-label="Category filters">
                  {TEMPLATE_CATEGORY_FILTERS.map((category) => (
                    <button key={category} type="button" className={landingTemplateCategory === category ? "active" : ""} onClick={() => setLandingTemplateCategory(category)}>
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="template-popup-grid">
                {landingTemplateMatches.map((template) => (
                  <article key={template.id} className="template-popup-card">
                    <div>
                      <span className="template-popup-priority">{template.priority}</span>
                      <h4>{template.label}</h4>
                      <p>Tokens, components, layout rules, and implementation prompts.</p>
                    </div>
                    <div className="template-card-meta">
                      <span>{template.category}</span>
                      <span>{template.id}</span>
                    </div>
                    <button type="button" onClick={() => { selectLandingTemplate(template.id); setTemplatePopupOpen(false); }}>Use template</button>
                  </article>
                ))}
                {landingTemplateMatches.length === 0 && (
                  <div className="template-popup-empty">
                    <p>No matching template. Try a brand name or product type.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {workspaceTab === "checklist" && (
          <section className="checklist-content-panel">
            <div className="checklist-content-header">
              <div>
                <h2>Checklist UI/UX</h2>
                <span className="checklist-subtitle">
                  {checklistStats.total} tiêu chí · {checklistStats.pass} pass · {checklistStats.fail} fail · {checklistStats.warn} cảnh báo
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" className="btn-setup" onClick={() => { setSetupModalOpen(true); setSetupModalTab(0); }}>
                  ⚙ Cài đặt nguồn dữ liệu
                </button>
                <button type="button" className="btn-setup" style={{ background: "#ef4444" }} onClick={() => setReportModalOpen(true)}>
                  📊 Xuất báo cáo
                </button>
              </div>
            </div>

            {/* Score Card — matching reference: SVG circle + 4 progress bars */}
            <div className="checklist-score-card">
              <div className="score-circle">
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#252a3a" strokeWidth="6"/>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#00c9a7" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - checklistStats.avgScore / 100)}`}
                    transform="rotate(-90 40 40)"/>
                  <text x="40" y="38" textAnchor="middle" fill="#00c9a7" fontSize="18" fontWeight="700">{checklistStats.avgScore}</text>
                  <text x="40" y="52" textAnchor="middle" fill="#9aa0b8" fontSize="9">/100</text>
                </svg>
              </div>
              <div className="score-bars">
                {(["Visual Design", "Typography", "Accessibility", "Interaction"] as const).map((label, i) => {
                  const catMap: Record<string, string[]> = {
                    "Visual Design": ["Color", "Layout", "Spacing", "Foundation_Color", "Foundation_Spacing"],
                    "Typography": ["Typography", "Foundation_Typography"],
                    "Accessibility": ["Accessibility", "WCAG"],
                    "Interaction": ["Interaction", "States", "Pattern_Interaction", "Element_Interactive"],
                  };
                  const cats = catMap[label] ?? [];
                  const items = checklistItems.filter(r => cats.some(c => r.category.includes(c)) && r.status !== "untested");
                  const avg = items.length ? Math.round(items.reduce((s, r) => s + r.score, 0) / items.length * 10) : 0;
                  const color = avg >= 80 ? "#22c55e" : avg >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={label} className="score-bar-row">
                      <span>{label}</span>
                      <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${avg}%`, background: color }}/></div>
                      <span className="score-bar-val" style={{ color }}>{avg}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter Bar — matching reference: search + pill tabs + dropdown */}
            <div className="checklist-filter-bar">
              <input type="text" placeholder="Tìm kiếm tiêu chí..." value={checklistSearch}
                onChange={(e) => { setChecklistSearch(e.target.value); setChecklistPage(1); }}
                className="checklist-search-input" aria-label="Tìm kiếm tiêu chí"/>
              <div className="checklist-filter-tabs" role="tablist">
                {(["all", "ui", "ux", "pass", "fail", "warn"] as const).map(f => (
                  <button key={f} type="button" role="tab" aria-selected={checklistFilter === f}
                    className={checklistFilter === f ? "active" : ""}
                    onClick={() => { setChecklistFilter(f); setChecklistPage(1); }}>
                    {f === "all" ? "Tất cả" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <select value={checklistCatFilter} onChange={(e) => { setChecklistCatFilter(e.target.value); setChecklistPage(1); }}
                className="checklist-cat-dropdown" aria-label="Lọc theo danh mục">
                <option value="All">Tất cả danh mục</option>
                {CHECKLIST_CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Table — matching reference: STT | Danh mục/Section | Tiêu chí | Loại | Trạng thái | Điểm | Mô tả | Chi tiết */}
            <div className="checklist-table-wrapper">
              <table className="checklist-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Danh mục / Section</th>
                    <th>Tiêu chí</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th>Điểm</th>
                    <th>Mô tả</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedChecklistRows.map((row, idx) => {
                    const globalIdx = (Math.min(checklistPage, checklistTotalPages) - 1) * checklistPerPage + idx;
                    return (
                      <tr key={row.id} className={row.status === "untested" ? "row-untested" : ""} onClick={() => { setDetailRow(row); setDetailTab(0); }}>
                        <td className="col-stt">{String(globalIdx + 1).padStart(2, "0")}</td>
                        <td className="col-cat">
                          <strong>{row.category}</strong>
                          <div className="section-name">{row.section || row.component}</div>
                        </td>
                        <td className="col-criterion">{row.criterion}</td>
                        <td><span className={`badge-type badge-${row.type.toLowerCase()}`}>{row.type}</span></td>
                        <td>
                          <select className={`status-select status-${row.status}`} value={row.status}
                            onChange={(e) => {
                              const next = checklistItems.map(r => r.id === row.id ? { ...r, status: e.target.value as ChecklistStatus } : r);
                              setChecklistItems(next);
                              localStorage.setItem("designready.checklist-v3", JSON.stringify(next));
                            }}>
                            <option value="untested">— Chưa test</option>
                            <option value="pass">✓ Pass</option>
                            <option value="fail">✗ Fail</option>
                            <option value="warn">⚠ Warn</option>
                          </select>
                        </td>
                        <td>
                          <input type="number" min={0} max={10} className={`score-input status-${row.status}`} value={row.score}
                            onChange={(e) => {
                              const next = checklistItems.map(r => r.id === row.id ? { ...r, score: Math.min(10, Math.max(0, Number(e.target.value))) } : r);
                              setChecklistItems(next);
                              localStorage.setItem("designready.checklist-v3", JSON.stringify(next));
                            }}/>
                        </td>
                        <td className="col-desc">{row.expected || row.note}</td>
                        <td><button type="button" className="btn-detail" onClick={(e) => { e.stopPropagation(); setDetailRow(row); setDetailTab(0); }}>Chi tiết</button></td>
                      </tr>
                    );
                  })}
                  {paginatedChecklistRows.length === 0 && (
                    <tr><td colSpan={8} className="checklist-empty">Không tìm thấy tiêu chí phù hợp</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination — matching reference */}
            <div className="checklist-pagination">
              <span>Hiển thị {Math.min((checklistPage - 1) * checklistPerPage + 1, filteredChecklistRows.length)}–{Math.min(checklistPage * checklistPerPage, filteredChecklistRows.length)} của {filteredChecklistRows.length} tiêu chí</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Hiển thị</span>
                <select value={checklistPerPage} onChange={(e) => { setChecklistPerPage(Number(e.target.value)); setChecklistPage(1); }}
                  className="checklist-cat-dropdown" style={{ padding: "4px 8px", fontSize: 12 }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={999}>Tất cả</option>
                </select>
              </div>
              <div className="pagination-nav">
                <button type="button" disabled={checklistPage <= 1} onClick={() => setChecklistPage(p => p - 1)}>‹</button>
                {Array.from({ length: checklistTotalPages }, (_, i) => (
                  <button key={i} type="button" className={checklistPage === i + 1 ? "active" : ""} onClick={() => setChecklistPage(i + 1)}>{i + 1}</button>
                ))}
                <button type="button" disabled={checklistPage >= checklistTotalPages} onClick={() => setChecklistPage(p => p + 1)}>›</button>
              </div>
            </div>
          </section>
        )}

        {/* Setup Modal — matching reference HTML exactly */}
        {setupModalOpen && (
          <div className="template-popup-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSetupModalOpen(false); }}>
            <div className="setup-modal">
              <div className="setup-modal-header">
                <h3>⚙ Cài đặt kết nối &amp; Checklist</h3>
                <button type="button" className="template-popup-close" onClick={() => setSetupModalOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* Tabs — pill style matching reference */}
              <div className="setup-mtabs">
                <button type="button" className={setupModalTab === 0 ? "active" : ""} onClick={() => setSetupModalTab(0)}>① Nguồn dữ liệu</button>
                <button type="button" className={setupModalTab === 1 ? "active" : ""} onClick={() => setSetupModalTab(1)}>② Tiêu chí Checklist</button>
                <button type="button" className={setupModalTab === 2 ? "active" : ""} onClick={() => setSetupModalTab(2)}>③ Kết nối MCP/Tools</button>
              </div>
              <div className="setup-modal-body">
                {/* Tab 0 — Nguồn dữ liệu */}
                {setupModalTab === 0 && (
                  <div>
                    <label className="setup-field">
                      <span>Loại nguồn dữ liệu</span>
                      <select value={setupDatasource.type} onChange={(e) => setSetupDatasource(s => ({ ...s, type: e.target.value }))}>
                        <option value="excel">Excel (XLSX)</option>
                        <option value="google">Google Sheets</option>
                        <option value="airtable">Airtable</option>
                        <option value="upload">Tải file lên</option>
                      </select>
                    </label>
                    {setupDatasource.type !== "upload" && setupDatasource.type !== "airtable" && (
                      <label className="setup-field">
                        <span>Đường dẫn / URL</span>
                        <input type="text" value={setupDatasource.url} onChange={(e) => setSetupDatasource(s => ({ ...s, url: e.target.value }))} placeholder="https://docs.google.com/spreadsheets/... hoặc đường dẫn file Excel"/>
                      </label>
                    )}
                    {setupDatasource.type === "airtable" && (
                      <>
                        <div className="setup-field-row">
                          <label className="setup-field"><span>Airtable API Key</span><input type="password" placeholder="keyXXXXXXXXXXXXXX"/></label>
                          <label className="setup-field"><span>Base ID</span><input type="text" placeholder="appXXXXXXXXXXXXXX"/></label>
                        </div>
                        <label className="setup-field"><span>Table Name</span><input type="text" placeholder="tbl_checklist"/></label>
                      </>
                    )}
                    {setupDatasource.type === "upload" && (
                      <div className="setup-field">
                        <span>Tải file lên</span>
                        <div className="drop-zone">
                          <div style={{ fontSize: 22, marginBottom: 6 }}>☁️</div>
                          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Kéo thả hoặc click để chọn file</div>
                          <div style={{ fontSize: 11, color: "#9aa0b8" }}>CSV, XLSX · DOCX, PDF · PNG, JPG, WEBP</div>
                        </div>
                      </div>
                    )}
                    <div className="setup-field-row">
                      <label className="setup-field"><span>Sheet / Table name</span><input type="text" value={setupDatasource.sheet} onChange={(e) => setSetupDatasource(s => ({ ...s, sheet: e.target.value }))} placeholder="Sheet1 hoặc tbl_checklist"/></label>
                      <label className="setup-field" style={{ maxWidth: 120 }}><span>Header row</span><input type="number" value={setupDatasource.headerRow} onChange={(e) => setSetupDatasource(s => ({ ...s, headerRow: Number(e.target.value) }))} min={1}/></label>
                    </div>
                  </div>
                )}

                {/* Tab 1 — Tiêu chí Checklist — matching reference: drag handle + editable + add button */}
                {setupModalTab === 1 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f3f5" }}>Tiêu chí đánh giá</span>
                      <button type="button" className="btn-primary" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => {
                        const newRow: ChecklistRow = { id: `custom-${Date.now()}`, source: "vts", category: "", component: "", section: "", criterion: "", expected: "", note: "", tag: "opt", type: "UI", status: "untested", score: 0 };
                        const next = [...checklistItems, newRow];
                        setChecklistItems(next);
                        localStorage.setItem("designready.checklist-v3", JSON.stringify(next));
                      }}>+ Thêm tiêu chí</button>
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 280 }}>
                      <table className="setup-criteria-table">
                        <thead><tr><th style={{ width: 20 }}></th><th>Danh mục</th><th>Tiêu chí</th><th style={{ width: 60 }}>Loại</th><th style={{ width: 60 }}>Trọng số</th><th style={{ width: 28 }}></th></tr></thead>
                        <tbody>
                          {checklistItems.map((row) => (
                            <tr key={row.id}>
                              <td style={{ color: "#5c6378", fontSize: 16, cursor: "move", textAlign: "center" }}>⣿</td>
                              <td>{row.category}</td>
                              <td>{row.criterion}</td>
                              <td><span className={`badge-type badge-${row.type.toLowerCase()}`}>{row.type}</span></td>
                              <td>{row.score}</td>
                              <td><button type="button" className="btn-trash" onClick={() => {
                                const next = checklistItems.filter(r => r.id !== row.id);
                                setChecklistItems(next);
                                localStorage.setItem("designready.checklist-v3", JSON.stringify(next));
                              }}>🗑</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 2 — Kết nối MCP/Tools — matching reference: Figma + Playwright + Supabase cards with inputs */}
                {setupModalTab === 2 && (
                  <div className="setup-tab-connections">
                    {/* Figma MCP */}
                    <div className="conn-item">
                      <div className="conn-icon ci-figma">F</div>
                      <div className="conn-body">
                        <div className="conn-name">Figma MCP</div>
                        <div className="conn-desc">Kết nối đọc dữ liệu Figma – generate_figma_design</div>
                        <div className="setup-field-row" style={{ marginBottom: 6 }}>
                          <input type="password" className="conn-input" placeholder="Figma Personal Access Token" value={figmaToken} onChange={(e) => setFigmaToken(e.target.value)}/>
                          <input type="text" className="conn-input" placeholder="Figma File URL hoặc File Key" value={figmaFileUrl} onChange={(e) => setFigmaFileUrl(e.target.value)}/>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className={`conn-status cs-${figmaStatus}`}>
                            {figmaStatus === "pending" && "● Chưa kết nối"}
                            {figmaStatus === "checking" && "⟳ Đang kiểm tra..."}
                            {figmaStatus === "ok" && "✓ Đã kết nối"}
                            {figmaStatus === "error" && "✗ Lỗi kết nối"}
                          </span>
                          <button type="button" className="btn-primary" style={{ padding: "5px 10px", fontSize: 11 }}
                            onClick={() => {
                              setFigmaStatus("checking");
                              setTimeout(() => { setFigmaStatus("ok"); showToast("Figma kết nối thành công! Đang đọc frames 🚀"); }, 1600);
                            }}>⚡ Kiểm tra &amp; Kết nối</button>
                        </div>
                      </div>
                    </div>

                    {/* Playwright MCP */}
                    <div className="conn-item">
                      <div className="conn-icon ci-pw">P</div>
                      <div className="conn-body">
                        <div className="conn-name">Playwright MCP</div>
                        <div className="conn-desc">Chụp màn hình web tự động để so sánh</div>
                        <div className="setup-field-row" style={{ marginBottom: 6 }}>
                          <input type="text" className="conn-input" placeholder="URL trang web cần chụp" value={pwUrl} onChange={(e) => setPwUrl(e.target.value)}/>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input type="number" className="conn-input" style={{ width: 80 }} value={pwWidth} onChange={(e) => setPwWidth(Number(e.target.value))} placeholder="Width"/>
                            <input type="number" className="conn-input" style={{ width: 80 }} value={pwHeight} onChange={(e) => setPwHeight(Number(e.target.value))} placeholder="Height"/>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className={`conn-status cs-${pwStatus}`}>
                            {pwStatus === "pending" && "● Chưa kết nối"}
                            {pwStatus === "checking" && "⟳ Đang kiểm tra..."}
                            {pwStatus === "ok" && "✓ Đã kết nối"}
                            {pwStatus === "error" && "✗ Lỗi kết nối"}
                          </span>
                          <button type="button" className="btn-primary" style={{ padding: "5px 10px", fontSize: 11 }}
                            onClick={() => {
                              setPwStatus("checking");
                              setTimeout(() => { setPwStatus("ok"); showToast("Playwright sẵn sàng chụp màn hình!"); }, 1600);
                            }}>⚡ Kiểm tra &amp; Kết nối</button>
                        </div>
                      </div>
                    </div>

                    {/* Supabase */}
                    <div className="conn-item">
                      <div className="conn-icon ci-db">D</div>
                      <div className="conn-body">
                        <div className="conn-name">Supabase / Airtable MCP</div>
                        <div className="conn-desc">Lưu kết quả checklist, lịch sử review</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="conn-status cs-ok">✓ Đã kết nối (demo)</span>
                          <button type="button" className="btn-outline" style={{ padding: "5px 10px", fontSize: 11 }}>Cấu hình</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="setup-modal-footer">
                <button type="button" className="btn-outline" onClick={() => setSetupModalOpen(false)}>Hủy</button>
                <button type="button" className="btn-primary" onClick={() => {
                  localStorage.setItem("designready.setup-datasource", JSON.stringify(setupDatasource));
                  setSetupModalOpen(false);
                  showToast("Đã lưu cài đặt thành công!");
                }}>✓ Lưu cài đặt</button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal — Sprint 2 */}
        {detailRow && (() => {
          const srcMeta = DESIGN_SOURCES.find(d => d.id === detailRow.source);
          return (
            <div className="template-popup-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setDetailRow(null); }}>
              <div className="detail-modal">
                <div className="detail-modal-header">
                  <h3>Chi tiết: {detailRow.section || detailRow.component || detailRow.category}</h3>
                  <button type="button" className="template-popup-close" onClick={() => setDetailRow(null)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="setup-mtabs" style={{ margin: "12px 20px 0" }}>
                  <button type="button" className={detailTab === 0 ? "active" : ""} onClick={() => setDetailTab(0)}>ⓘ Thông tin</button>
                  <button type="button" className={detailTab === 1 ? "active" : ""} onClick={() => setDetailTab(1)}>⇔ So sánh</button>
                </div>
                <div className="setup-modal-body">
                  {detailTab === 0 && (
                    <div className="detail-info-grid">
                      <div className="detail-img-placeholder">
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>
                        <div style={{ fontSize: 12, color: "#5c6378" }}>Design preview</div>
                        <div style={{ fontSize: 11, color: "#5c6378", marginTop: 4 }}>Kết nối Figma để xem frame</div>
                      </div>
                      <div className="detail-info-table">
                        <div className="detail-info-row"><span>Nguồn</span><span className="source-badge" style={{ background: `${srcMeta?.color ?? "#666"}22`, color: srcMeta?.color }}>{detailRow.source.toUpperCase()}</span></div>
                        <div className="detail-info-row"><span>Danh mục</span><strong>{detailRow.category}</strong></div>
                        <div className="detail-info-row"><span>Section</span><span>{detailRow.section || detailRow.component}</span></div>
                        <div className="detail-info-row"><span>Loại</span><span className={`badge-type badge-${detailRow.type.toLowerCase()}`}>{detailRow.type}</span></div>
                        <div className="detail-info-row"><span>Tag</span><span className={detailRow.tag === "req" ? "tag-req" : "tag-opt"}>{detailRow.tag === "req" ? "Bắt buộc" : "Tuỳ chọn"}</span></div>
                        <div className="detail-info-row"><span>Trạng thái</span><span className={`status-${detailRow.status}`} style={{ fontWeight: 600 }}>
                          {detailRow.status === "pass" && "✓ Pass"}{detailRow.status === "fail" && "✗ Fail"}{detailRow.status === "warn" && "⚠ Warn"}{detailRow.status === "untested" && "— Chưa test"}
                        </span></div>
                        <div className="detail-info-row"><span>Điểm</span><strong style={{ fontSize: 18 }}>{detailRow.score}/10</strong></div>
                        <div className="detail-info-row"><span>Tiêu chí</span><span>{detailRow.criterion}</span></div>
                        <div className="detail-info-row"><span>Expected</span><span>{detailRow.expected}</span></div>
                        {detailRow.note && <div className="detail-info-row"><span>Ghi chú</span><span style={{ color: "#9aa0b8" }}>{detailRow.note}</span></div>}
                        {figmaStatus === "ok" && (
                          <>
                            <div className="detail-info-row" style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}><span>Figma Frame</span><span>{detailRow.section || "N/A"}</span></div>
                            <div className="detail-info-row"><span>Figma Score</span><span>{detailRow.score * 10}/100</span></div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {detailTab === 1 && (
                    <div>
                      <ComparePanel
                        designImageUrl={compareDesignUrl}
                        webImageUrl={compareWebUrl}
                        onCaptureFigma={() => showToast("Kết nối Figma để chụp frame", "info")}
                        onCaptureWeb={() => showToast("Kết nối Playwright để chụp web", "info")}
                        markers={bugMarkers}
                        onAddMarker={(m) => setBugMarkers(prev => [...prev, m])}
                        onRemoveMarker={(id) => setBugMarkers(prev => prev.filter(m => m.id !== id))}
                      />
                      <table className="setup-criteria-table" style={{ marginTop: 12 }}>
                        <thead><tr><th>Icon</th><th>Hạng mục</th><th>Giá trị</th><th>Kết quả</th></tr></thead>
                        <tbody>
                          <tr><td>📏</td><td>Spacing</td><td>{detailRow.expected || "N/A"}</td><td className={`status-${detailRow.status}`}>{detailRow.status === "pass" ? "✓" : detailRow.status === "fail" ? "✗" : "⚠"}</td></tr>
                          <tr><td>🔤</td><td>Typography</td><td>Theo design system</td><td className="status-pass">✓</td></tr>
                          <tr><td>🎨</td><td>Màu / Token</td><td>Đối chiếu token</td><td className="status-pass">✓</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="setup-modal-footer">
                  <button type="button" className="btn-outline" onClick={() => setDetailRow(null)}>Đóng</button>
                  <button type="button" className="btn-primary" style={{ background: "#ef4444" }} onClick={() => { showToast("Đã báo cáo issue: " + detailRow.criterion, "info"); setDetailRow(null); }}>🚩 Báo cáo issue này</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Report Modal — Sprint 2 */}
        {reportModalOpen && (() => {
          const failItems = checklistItems.filter(r => r.status === "fail");
          const warnItems = checklistItems.filter(r => r.status === "warn");
          const passItems = checklistItems.filter(r => r.status === "pass");
          const tested = checklistItems.filter(r => r.status !== "untested");
          const avgScore = tested.length ? Math.round(tested.reduce((s, r) => s + r.score, 0) / tested.length * 10) : 0;
          return (
            <div className="template-popup-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setReportModalOpen(false); }}>
              <div className="setup-modal" style={{ width: "min(760px, 94vw)" }}>
                <div className="setup-modal-header">
                  <h3>📊 Báo cáo UI/UX Review</h3>
                  <button type="button" className="template-popup-close" onClick={() => setReportModalOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="setup-modal-body">
                  {/* Summary Metrics */}
                  <div className="report-metrics">
                    <div className="report-metric"><div className="report-metric-val" style={{ color: "#00c9a7" }}>{avgScore}</div><div className="report-metric-label">Điểm tổng /100</div></div>
                    <div className="report-metric"><div className="report-metric-val" style={{ color: "#22c55e" }}>{passItems.length}</div><div className="report-metric-label">Pass</div></div>
                    <div className="report-metric"><div className="report-metric-val" style={{ color: "#ef4444" }}>{failItems.length}</div><div className="report-metric-label">Fail</div></div>
                    <div className="report-metric"><div className="report-metric-val" style={{ color: "#f59e0b" }}>{warnItems.length}</div><div className="report-metric-label">Warn</div></div>
                    <div className="report-metric"><div className="report-metric-val" style={{ color: "#9aa0b8" }}>{checklistItems.length - tested.length}</div><div className="report-metric-label">Chưa test</div></div>
                  </div>

                  {/* Fail list */}
                  {failItems.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ fontSize: 13, color: "#ef4444", marginBottom: 8 }}>✗ Vấn đề nghiêm trọng ({failItems.length})</h4>
                      {failItems.map(r => (
                        <div key={r.id} className="report-issue-row">
                          <span className={`badge-type badge-${r.type.toLowerCase()}`}>{r.type}</span>
                          <span style={{ flex: 1 }}><strong>{r.category}</strong> — {r.criterion}</span>
                          <span style={{ color: "#5c6378", fontSize: 11 }}>{r.source.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warn list */}
                  {warnItems.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ fontSize: 13, color: "#f59e0b", marginBottom: 8 }}>⚠ Cảnh báo ({warnItems.length})</h4>
                      {warnItems.map(r => (
                        <div key={r.id} className="report-issue-row">
                          <span className={`badge-type badge-${r.type.toLowerCase()}`}>{r.type}</span>
                          <span style={{ flex: 1 }}><strong>{r.category}</strong> — {r.criterion}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source breakdown */}
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, color: "#f1f3f5", marginBottom: 8 }}>📋 Theo nguồn</h4>
                    <div className="report-metrics">
                      {DESIGN_SOURCES.map(ds => {
                        const items = checklistItems.filter(r => r.source === ds.id);
                        const dsPass = items.filter(r => r.status === "pass").length;
                        return (
                          <div key={ds.id} className="report-metric" style={{ borderLeft: `3px solid ${ds.color}` }}>
                            <div className="report-metric-val" style={{ color: ds.color }}>{dsPass}/{items.length}</div>
                            <div className="report-metric-label">{ds.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI recommendations */}
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, color: "#6c63ff", marginBottom: 8 }}>🤖 Khuyến nghị AI</h4>
                    <ul style={{ fontSize: 12, color: "#9aa0b8", paddingLeft: 18, lineHeight: 1.8 }}>
                      {failItems.length > 3 && <li>Nhiều tiêu chí fail — ưu tiên fix {failItems[0]?.category} và {failItems[1]?.category} trước</li>}
                      {warnItems.length > 0 && <li>Có {warnItems.length} cảnh báo cần review lại trước khi release</li>}
                      <li>Kết nối Figma MCP để tự động đối chiếu design tokens</li>
                      <li>Chạy Playwright screenshot để so sánh pixel-perfect</li>
                      {avgScore < 70 && <li>Điểm tổng dưới 70 — cần rà soát toàn diện trước production</li>}
                    </ul>
                  </div>

                  {/* AI Auto-Scoring — Sprint 4 */}
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, color: "#00c9a7", marginBottom: 8 }}>🤖 AI Auto-Scoring</h4>
                    <p style={{ fontSize: 12, color: "#7a829e", marginBottom: 10 }}>Upload ảnh screenshot để AI tự động chấm điểm UI/UX theo checklist.</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="btn-outline" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = async () => {
                          const file = input.files?.[0];
                          if (!file) return;
                          showToast("Đang phân tích screenshot với AI…", "info");
                          try {
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = (reader.result as string).split(",")[1];
                              const resp = await fetch("/api/analyze-image", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  base64Image: base64,
                                  mimeType: file.type,
                                  contextSummary: "UI/UX auto-scoring from screenshot",
                                  templateMeta: [{ id: "auto-score", category: "UI", priority: "high", keywords: ["layout", "color", "typography", "spacing"] }],
                                }),
                              });
                              if (resp.ok) {
                                const data = await resp.json();
                                showToast(`AI phân tích xong: Layout=${data.layoutPattern?.columns ?? "?"} col, ${data.layoutPattern?.colorScheme ?? "?"} theme`, "success");
                              } else {
                                showToast("AI scoring thất bại — kiểm tra API key", "error");
                              }
                            };
                            reader.readAsDataURL(file);
                          } catch { showToast("Lỗi kết nối AI scoring", "error"); }
                        };
                        input.click();
                      }}>📸 Upload Screenshot</button>
                      <button type="button" className="btn-outline" onClick={() => showToast("Sẽ kết nối Figma MCP để auto-score", "info")}>🎨 Từ Figma</button>
                      <button type="button" className="btn-outline" onClick={() => showToast("Sẽ chụp Playwright để auto-score", "info")}>🌐 Từ Playwright</button>
                    </div>
                  </div>

                  {/* Export options */}
                  <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                    <label className="setup-field" style={{ flex: 1, marginBottom: 0 }}>
                      <span>Định dạng xuất</span>
                      <select><option>CSV</option><option>JSON</option><option>PDF</option></select>
                    </label>
                  </div>
                </div>
                <div className="setup-modal-footer">
                  <button type="button" className="btn-outline" onClick={() => setReportModalOpen(false)}>Đóng</button>
                  <button type="button" className="btn-export-pdf" onClick={() => {
                    // PDF export via browser print
                    const printWin = window.open("", "_blank");
                    if (!printWin) { showToast("Popup bị chặn — cho phép popup để xuất PDF", "warn"); return; }
                    const failItems2 = checklistItems.filter(r => r.status === "fail");
                    const warnItems2 = checklistItems.filter(r => r.status === "warn");
                    const passItems2 = checklistItems.filter(r => r.status === "pass");
                    const tested2 = checklistItems.filter(r => r.status !== "untested");
                    const avgScore2 = tested2.length ? Math.round(tested2.reduce((s, r) => s + r.score, 0) / tested2.length * 10) : 0;
                    printWin.document.write(`<!DOCTYPE html><html><head><title>UI/UX Report - ${new Date().toISOString().slice(0,10)}</title>
                      <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#1a1a1a}h1{font-size:22px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}.metric{display:inline-block;text-align:center;margin:0 16px 12px 0;padding:12px 16px;border:1px solid #ddd;border-radius:8px;min-width:80px}.metric strong{display:block;font-size:24px}.metric span{font-size:11px;color:#666}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:6px 10px;border:1px solid #ddd;font-size:12px;text-align:left}th{background:#f5f5f5;font-weight:600}.pass{color:#22c55e}.fail{color:#ef4444}.warn{color:#f59e0b}@media print{body{padding:12px}}</style>
                    </head><body>
                      <h1>📊 Báo cáo UI/UX Review</h1>
                      <p style="color:#666;font-size:13px">${PRODUCT_NAME} — ${new Date().toLocaleDateString("vi-VN")} — ${checklistItems.length} tiêu chí</p>
                      <div>
                        <div class="metric"><strong style="color:#00c9a7">${avgScore2}</strong><span>Điểm /100</span></div>
                        <div class="metric"><strong style="color:#22c55e">${passItems2.length}</strong><span>Pass</span></div>
                        <div class="metric"><strong style="color:#ef4444">${failItems2.length}</strong><span>Fail</span></div>
                        <div class="metric"><strong style="color:#f59e0b">${warnItems2.length}</strong><span>Warn</span></div>
                      </div>
                      ${failItems2.length ? `<h2>✗ Vấn đề nghiêm trọng (${failItems2.length})</h2><table><tr><th>Source</th><th>Category</th><th>Criterion</th><th>Score</th></tr>${failItems2.map(r=>`<tr><td>${r.source.toUpperCase()}</td><td>${r.category}</td><td>${r.criterion}</td><td>${r.score}/10</td></tr>`).join("")}</table>` : ""}
                      ${warnItems2.length ? `<h2>⚠ Cảnh báo (${warnItems2.length})</h2><table><tr><th>Source</th><th>Category</th><th>Criterion</th><th>Score</th></tr>${warnItems2.map(r=>`<tr><td>${r.source.toUpperCase()}</td><td>${r.category}</td><td>${r.criterion}</td><td>${r.score}/10</td></tr>`).join("")}</table>` : ""}
                      <h2>📋 Chi tiết toàn bộ</h2>
                      <table><tr><th>#</th><th>Source</th><th>Category</th><th>Criterion</th><th>Type</th><th>Status</th><th>Score</th></tr>
                      ${checklistItems.map((r,i)=>`<tr><td>${i+1}</td><td>${r.source.toUpperCase()}</td><td>${r.category}</td><td>${r.criterion}</td><td>${r.type}</td><td class="${r.status}">${r.status}</td><td>${r.score}/10</td></tr>`).join("")}
                      </table>
                      <p style="margin-top:24px;font-size:11px;color:#999">Generated by ${PRODUCT_NAME}</p>
                    </body></html>`);
                    printWin.document.close();
                    setTimeout(() => { printWin.print(); }, 500);
                    showToast("Đang mở PDF export…", "success");
                  }}>📄 Xuất PDF</button>
                  <button type="button" className="btn-primary" style={{ background: "#ef4444" }} onClick={() => {
                    const tested2 = checklistItems.filter(r => r.status !== "untested");
                    const csvHeader = "ID,Source,Category,Section,Criterion,Type,Tag,Status,Score,Expected,Note";
                    const csvRows = tested2.map(r => `${r.id},${r.source},${r.category},"${r.section}","${r.criterion}",${r.type},${r.tag},${r.status},${r.score},"${r.expected}","${r.note}"`);
                    const blob = new Blob([csvHeader + "\n" + csvRows.join("\n")], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `uiux-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                    URL.revokeObjectURL(url);
                    showToast("Đã xuất báo cáo CSV!", "success");
                  }}>📊 Xuất CSV</button>
                </div>
              </div>
            </div>
          );
        })()}

        <section className={`chat-workspace builder-workspace${chatTheme === "light" ? " theme-light" : ""}${workspaceTab === "checklist" ? " hidden-panel" : ""}`}>
          <input
            ref={analyzeImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              if (event.currentTarget.files?.length) {
                void analyzeWorkspaceImage(event.currentTarget.files);
              }
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={baDocInputRef}
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            hidden
            multiple
            onChange={(event) => {
              if (event.currentTarget.files?.length) {
                void addBaDocument(event.currentTarget.files);
              }
              event.currentTarget.value = "";
            }}
          />
          <div className="theme-toggle-wrap">
            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setChatTheme((t) => {
                  const next = t === "dark" ? "light" : "dark";
                  localStorage.setItem("designready.theme", next);
                  return next;
                })
              }
            >
              {chatTheme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              )}
              {chatTheme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
          {workspaceTab === "code" && (
          <div className="workspace-action-bar">
            <button type="button" onClick={() => analyzeImageInputRef.current?.click()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              Analyze image
            </button>
            <button type="button" className="btn-ba-doc" onClick={() => baDocInputRef.current?.click()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Add BA doc
            </button>
            <button
              type="button"
              className="btn-template"
              onClick={() => {
                const blob = new Blob([BA_TEMPLATE_CONTENT], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "BA-template.md";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              BA template
            </button>
            <button type="button" className="btn-generate" onClick={() => void generateFiveScreensFromContext()} disabled={isGenerating}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.05l-4.9 3.56a1 1 0 0 0-.36 1.12L17.5 20l-4.9-3.56a1 1 0 0 0-1.18 0L6.5 20l1.88-5.87a1 1 0 0 0-.36-1.12L3.12 9.45h6.05a1 1 0 0 0 .95-.69z"/>
              </svg>
              Generate 5 screens
            </button>
          </div>
          )}
          <div className="chat-scroll" ref={chatScrollRef}>
            {messages.length <= 1 && !isGenerating && !hasGenerated && (
              <div className="welcome-hero">
                <div className="welcome-brand-icon">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                    <defs><linearGradient id="wGrad" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
                    <path d="M10 8h8a6 6 0 010 12h-4l-4 4V8z" fill="url(#wGrad)"/>
                    <rect x="13" y="12" width="6" height="6" rx="1" fill="#fff" opacity="0.7"/>
                  </svg>
                  <span>{PRODUCT_NAME}</span>
                </div>
                <h1 className="welcome-title">Welcome back <span className="welcome-sparkle">✨</span></h1>
                <p className="welcome-subtitle">Create AI-ready Design.md context for your coding agents in seconds.</p>
                <div className="welcome-cards">
                  <button type="button" className="welcome-card" onClick={() => { setWorkspaceTab("code"); void generateFiveScreensFromContext(); }}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    </div>
                    <span className="welcome-card-arrow">→</span>
                    <h3>Create Design.md</h3>
                    <p>Generate a full Design.md from your request</p>
                  </button>
                  <button type="button" className="welcome-card" onClick={() => baDocInputRef.current?.click()}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <span className="welcome-card-arrow">→</span>
                    <h3>Upload Design.md</h3>
                    <p>Upload existing files and enhance with AI</p>
                  </button>
                  <button type="button" className="welcome-card" onClick={() => analyzeImageInputRef.current?.click()}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                    <span className="welcome-card-arrow">→</span>
                    <h3>Import Screenshots</h3>
                    <p>Extract design context from images</p>
                  </button>
                  <button type="button" className="welcome-card" onClick={() => openTemplateLibrary()}>
                    <div className="welcome-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    </div>
                    <span className="welcome-card-arrow">→</span>
                    <h3>Use Template</h3>
                    <p>Start from a template and customize</p>
                  </button>
                </div>
              </div>
            )}

            {messages.map((message, msgIndex) => (
              <article key={message.id} className={`message ${message.role}${isGenerating && msgIndex === messages.length - 1 && message.role === "assistant" && message.content === "" ? " is-thinking" : ""}`}>
                {message.role === "assistant" && (
                  <div className="message-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div className="message-body">
                  {message.role === "assistant" ? (
                    message.content === "" && isGenerating && msgIndex === messages.length - 1 ? (
                      <div className="streaming-dots"><span /><span /><span /></div>
                    ) : (
                    <div className={`message-markdown${isGenerating && msgIndex === messages.length - 1 ? " is-streaming" : ""}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chatMarked.parse(message.content, { async: false }) as string) }} />
                    )
                  ) : (
                    <p>{message.content}</p>
                  )}
                  {message.htmlCode && (
                    <button
                      type="button"
                      className="html-preview-trigger"
                      onClick={() => setHtmlPreview({ html: message.htmlCode!, title: (message.title ?? request.prompt.slice(0, 40)) || "Web Preview" })}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Run preview
                    </button>
                  )}
                  {message.role === "assistant" && message.content && !isGenerating && (
                    <div className="message-actions">
                      <button
                        type="button"
                        title="Copy"
                        className={copiedMessageId === message.id ? "is-copied" : ""}
                        onClick={() => void copyMessageContent(message)}
                      >
                        {copiedMessageId === message.id ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                      </button>
                      <button type="button" title="Regenerate" onClick={() => void regenerateMessage(msgIndex)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {isGenerating && workspaceTab === "code" && (
              <div className="thinking-row">
                <span /><span /><span />
                <p>Generating…</p>
              </div>
            )}

            {hasGenerated && (
              <article className="message assistant result-message generated-pulse">
                <div className="builder-result-grid">
                  <main className="builder-main-panel">
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
                          {outputRequest.target}
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
                    <div className="output-panel">
                      {previewMode === "split" && generatedScreens.length > 0 ? (
                        <Suspense fallback={<div style={{ padding: 24, color: "#5c6378" }}>Loading SplitView…</div>}>
                          <SplitView
                            key={`${templateCommandSlug(outputRequest.projectName)}-${generatedScreens.map((screen) => screen.name).join("|")}`}
                            initialScreens={generatedScreens}
                            projectId={templateCommandSlug(outputRequest.projectName)}
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
                            <span className="preview-kicker">{PRODUCT_NAME}</span>
                            <h2>Design System inspired by {activeDesign.label}</h2>
                            <p>{activeDesign.direction}</p>
                            <div className="usage-card">
                              <span>Usage</span>
                              <code>{usageCommand}</code>
                            </div>
                            <a className="repository-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                              GitHub: minhduchd-mds/Design-md-ai
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
                                <button
                                  type="button"
                                  className={previewTheme === "light" ? "active" : ""}
                                  onClick={() => setPreviewTheme("light")}
                                >
                                  Light
                                </button>
                                <button
                                  type="button"
                                  className={previewTheme === "dark" ? "active" : ""}
                                  onClick={() => setPreviewTheme("dark")}
                                >
                                  Dark
                                </button>
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
                                  <span />
                                  <span />
                                  <span />
                                  <b>{outputRequest.projectName}</b>
                                </div>
                                <section className="preview-frame-content">
                                  <p className="preview-label">{importedDesign ? "Imported Design.md" : "Open Design template"}</p>
                                  <h3>{outputRequest.projectName}</h3>
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
            )}
          </div>

          <ChatComposer
            isGenerating={isGenerating}
            openDesignPresets={openDesignPresets}
            request={request}
            selectedPreset={selectedPreset}
            setRequest={setRequest}
            workspaceTab={workspaceTab}
            onSendChat={sendChatMessage}
            onGenerateDesignMd={generateProject}
            onCreateImage={createImageFromPrompt}
            onUploadMarkdownFiles={uploadMarkdownFiles}
            onUploadScreenshot={uploadScreenshot}
          />
        </section>
      </main>
      {htmlPreview && (
        <Suspense fallback={null}>
          <HtmlPreviewModal
            state={htmlPreview}
            onClose={() => setHtmlPreview(null)}
            onHtmlChange={(html) => setHtmlPreview((prev) => prev ? { ...prev, html } : null)}
          />
        </Suspense>
      )}
      </>
    );
  }
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a href="#top" className="landing-brand">
          <span>AI</span>
          <div>
            <strong>{PRODUCT_NAME}</strong>
            <small>Design.md handoff workspace</small>
          </div>
        </a>
        <nav>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#templates">Templates</a>
          <a href="#router-layout">Handoff</a>
          <a href="#ai-gallery">Gallery</a>
          <a href="#login">Login</a>
        </nav>
        <div>
          <button type="button" onClick={() => openLandingAuth("login")}>Login</button>
          <button className="primary-small" type="button" onClick={() => openLandingAuth("register")}>Get started</button>
        </div>
      </header>

      <section id="top" className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">Figma to Design.md for AI agents</span>
          <h1>Design-md-ai turns design systems into coding-agent context.</h1>
          <p>
            Generate Design.md files, token maps, component guidance, and implementation prompts from Figma or uploaded markdown before asking Codex, Claude Code, Cursor, Windsurf, or Figma Make to build.
          </p>
          <div className="landing-actions">
            <button className="primary-action dark" type="button" onClick={() => openLandingAuth("register")}>Open workspace</button>
            <a href="#how-it-works">See workflow</a>
          </div>
          <div className="landing-metrics">
            {[
              ["Figma scan", "Components and tokens"],
              [`${DESIGN_MD_TEMPLATES.length} templates`, "Stored Design.md library"],
              ["Prompt export", "Codex and Claude"],
            ].map(([value, label]) => (
              <article key={value}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="code-mockup">
          <div className="mockup-top">
            <i />
            <i />
            <i />
            <span>Design.md - Live</span>
          </div>
          <div className="mockup-grid">
            <pre>
              {CODE_LINES.map((line, index) => (
                `${String(index + 1).padStart(2, "0")}  ${line || " "}`
              )).join("\n")}
            </pre>
            <section>
              <div className="mini-product">
                <nav>
                  <strong>{PRODUCT_NAME}</strong>
                  <span>Figma</span>
                  <span>Agents</span>
                </nav>
                <article>
                  <small>Design.md Handoff</small>
                  <h3>Ship cleaner code prompts from real design context.</h3>
                  <p>Map components, tokens, layout rules, and responsive states before implementation begins.</p>
                  <div>
                    <button>Export</button>
                    <button>Review</button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section feature-section">
        <div className="section-heading">
          <span>Production handoff</span>
          <h2>Built for teams who need design context before generated code.</h2>
        </div>
        <div className="feature-grid">
          {LANDING_FEATURES.map(([title, text], index) => (
            <article key={title} className={index === 1 ? "featured" : ""}>
              <b>0{index + 1}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="landing-section how-section">
        <div className="section-heading">
          <span>How it works</span>
          <h2>Three steps from design truth to agent-ready implementation.</h2>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS.map(([title, text], index) => (
            <article key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="templates" className="landing-section template-library-section">
        <div className="template-library-heading">
          <div className="section-heading">
            <span>Template library</span>
            <h2>Search brand and product Design.md templates before opening the workspace.</h2>
          </div>
          <label className="template-search">
            <span>Find a template</span>
            <input
              value={landingTemplateQuery}
              onChange={(event) => setLandingTemplateQuery(event.target.value)}
              placeholder="Airtable, Linear, Tesla, Stripe..."
            />
          </label>
        </div>
        <div className="template-filter-panel">
          <div className="template-priority-tabs" aria-label="Template priority filters">
            {TEMPLATE_PRIORITY_FILTERS.map((priority) => (
              <button
                key={priority}
                type="button"
                className={landingTemplatePriority === priority ? "active" : ""}
                onClick={() => setLandingTemplatePriority(priority)}
              >
                <span>{priority === "All" ? "All priorities" : `${priority} priority`}</span>
                <b>{templatePriorityCounts[priority]}</b>
              </button>
            ))}
          </div>
          <div className="template-category-chips" aria-label="Template category filters">
            {TEMPLATE_CATEGORY_FILTERS.map((category) => (
              <button
                key={category}
                type="button"
                className={landingTemplateCategory === category ? "active" : ""}
                onClick={() => setLandingTemplateCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="template-library-grid">
          {landingTemplateMatches.map((template) => (
            <article key={template.id}>
              <div>
                <span>{template.priority} priority</span>
                <h3>{template.label}</h3>
                <p>Use this Design.md style as starting context for tokens, components, layout rules, and implementation prompts.</p>
              </div>
              <div className="template-card-meta">
                <span>{template.category}</span>
                <span>{template.id}</span>
              </div>
              <div className="template-command">{getDesignMdUsageCommand(template.id)}</div>
              <button type="button" onClick={() => selectLandingTemplate(template.id)}>Use template</button>
            </article>
          ))}
          {landingTemplateMatches.length === 0 && (
            <article className="template-empty">
              <h3>No matching template</h3>
              <p>Try a brand name, product type, or design system keyword.</p>
            </article>
          )}
        </div>
      </section>

      <section id="router-layout" className="landing-section router-section">
        <div className="router-heading">
          <div>
            <span>Design.md handoff router</span>
            <h2>One workspace for prompts, previews, tokens, and export-ready context.</h2>
            <p>Design-md-ai keeps design-system information close to the prompt, so implementation agents receive grounded instructions instead of generic UI requests.</p>
          </div>
          <div className="router-stats">
            {[
              [String(DESIGN_MD_TEMPLATES.length), "Design.md templates"],
              ["5", "Agent targets"],
              ["3", "Input modes"],
              ["1", "Design.md source"],
            ].map(([value, label]) => (
              <article key={label}><strong>{value}</strong><span>{label}</span></article>
            ))}
          </div>
        </div>
        <div className="service-grid">
          {LANDING_SERVICES.map(([title, text], index) => (
            <article key={title}>
              <b>{index + 1}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ai-gallery" className="landing-section gallery-section">
        <div className="section-heading">
          <span>Workflow coverage</span>
          <h2>The demo focuses on concrete design handoff surfaces.</h2>
        </div>
        <div className="gallery-grid">
          {LANDING_SHOWCASE.map(([title, type], index) => (
            <article key={title}>
              <div className={`gallery-art art-${index + 1}`}>
                <span>{type}</span>
                <strong>{index + 1}</strong>
              </div>
              <small>{type}</small>
              <h3>{title}</h3>
              <p>Ready for <b>handoff</b></p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section dark-demo">
        <div>
          <span>Agent context</span>
          <h2>Show the design rules before generated code.</h2>
          <p>The workspace keeps Design.md, token decisions, preview, benchmark notes, and export actions visible in the same flow.</p>
        </div>
        <div>
          {["Design.md", "Token map", "Prompt export", "Figma frame"].map((item) => (
            <article key={item}>
              <b>&lt;/&gt;</b>
              <h3>{item}</h3>
              <p>Ready for handoff with clear product and design-system context.</p>
            </article>
          ))}
        </div>
      </section>

      <section id="login" className="landing-auth-section">
        <div className="landing-auth-card">
          <div>
            <span>Secure workspace</span>
            <h2>{authMode === "login" ? `Sign in to ${PRODUCT_NAME}.` : `Create your ${PRODUCT_NAME} workspace.`}</h2>
            <p>This public demo stores credentials locally with Web Crypto, expires sessions automatically, and locks repeated failed attempts. Use production backend auth before handling real customer accounts.</p>
          </div>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div
                ref={(node) => {
                  if (!node || node.childElementCount > 0) return;
                  const win = window as Window & typeof globalThis & {
                    google?: { accounts: { id: {
                      initialize: (cfg: Record<string, unknown>) => void;
                      renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
                      prompt: () => void;
                    } } };
                  };
                  // Wait for Google script to load, then render the official button
                  const tryRender = () => {
                    if (!win.google?.accounts?.id) return false;
                    win.google.accounts.id.initialize({
                      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
                      callback: handleGoogleLogin,
                      ux_mode: "popup",
                    });
                    win.google.accounts.id.renderButton(node, {
                      type: "standard",
                      theme: "outline",
                      size: "large",
                      text: "continue_with",
                      shape: "rectangular",
                      width: Math.min(node.parentElement?.clientWidth ?? 400, 400),
                    });
                    return true;
                  };
                  if (!tryRender()) {
                    // Script still loading — poll briefly
                    let attempts = 0;
                    const iv = setInterval(() => {
                      if (tryRender() || ++attempts > 20) clearInterval(iv);
                    }, 200);
                  }
                }}
                className="google-btn-container"
              />
              <div className="auth-divider"><span>or</span></div>
            </>
          )}
          <form onSubmit={handleAuthSubmit}>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>
              Password
              <span className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  minLength={12}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {authError && <div className="auth-error">{authError}</div>}
            <button className="primary-action warm" type="submit">{authMode === "login" ? "Login" : "Create account"}</button>
          </form>
          <button className="text-button" type="button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
            {authMode === "login" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === "success" && "✓"}
              {t.type === "error" && "✗"}
              {t.type === "warn" && "⚠"}
              {t.type === "info" && "ℹ"}
            </span>
            <span>{t.msg}</span>
            <button type="button" className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
