import { useEffect, useMemo, useState, useCallback } from "react";
import type {
  DesignSystemComponentInfo,
  DesignSystemSnapshot,
  DesignSystemVariableInfo,
  ScanResult,
} from "../../shared/types";
import { createZipBlob } from "../lib/zip";
import { useI18n } from "../i18n/I18nContext";
import { UiUxEvaluationPanel } from "./UiUxEvaluationPanel";
import { BADocumentPanel } from "./BADocumentPanel";
import type { BADocument } from "./BADocumentPanel";
import { StandardsChecklist } from "./StandardsChecklist";
import type { StandardItem } from "./StandardsChecklist";
import { ScreenGenPanel } from "./ScreenGenPanel";
import { ExportHub } from "./ExportHub";

interface DesignProjectPanelProps {
  snapshot: DesignSystemSnapshot | null;
  isLoading: boolean;
  error: string | null;
  scanResult: ScanResult | null;
  onRefresh: () => void;
}

interface ProjectFile {
  path: string;
  content: string;
}

interface UiCriterionScore {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

interface OpenDesignPreset {
  id: string;
  label: string;
  category: string;
  summary: string;
  tokens: string[];
  components: string[];
  guardrails: string[];
}

interface TemplateSectionDefinition {
  title: string;
  pattern: RegExp;
  fallbackCount: number;
}

const INDUSTRIES = [
  "AI & LLM",
  "Developer Tools",
  "Productivity & SaaS",
  "Backend & Data",
  "Design & Creative",
  "Fintech & Crypto",
  "E-Commerce & Retail",
  "Media & Consumer",
  "Automotive",
  "Finance",
  "Telecommunications",
  "Healthcare",
  "Education",
  "Government",
  "Real Estate",
  "Travel & Hospitality",
];
const DESIGN_STYLES = [
  "Simple product UI",
  "Landing page system",
  "Enterprise dashboard",
  "Mobile-first product",
  "SaaS operations",
  "AI assistant workspace",
  "Developer console",
  "Data-heavy analytics",
  "Minimal productivity",
  "Editorial content system",
  "Luxury product UI",
  "Futuristic command center",
  "Friendly consumer app",
  "Neobrutalist marketing",
  "Glassmorphism",
  "Gradient-rich launch",
  "Corporate operations",
];
const LAYOUT_TEMPLATES = [
  "Dashboard",
  "Admin table",
  "Settings",
  "Landing page",
  "Mobile app",
  "AI workspace",
  "Developer console",
];

const TEMPLATE_SECTION_DEFINITIONS: Record<string, TemplateSectionDefinition[]> = {
  "Admin table": [
    { title: "Header and filters", pattern: /nav|header|filter|search|input|select|button/i, fallbackCount: 6 },
    { title: "Table and pagination", pattern: /table|row|cell|pagination|checkbox|badge/i, fallbackCount: 8 },
    { title: "Empty, loading, and error states", pattern: /empty|loading|skeleton|alert|toast|error/i, fallbackCount: 4 },
  ],
  Settings: [
    { title: "Settings navigation", pattern: /nav|tab|menu|sidebar/i, fallbackCount: 4 },
    { title: "Form groups", pattern: /form|field|input|select|checkbox|radio|switch|button/i, fallbackCount: 8 },
    { title: "Save and danger actions", pattern: /button|alert|modal|dialog|toast/i, fallbackCount: 5 },
  ],
  "Landing page": [
    { title: "Hero and primary CTA", pattern: /hero|nav|button|badge|card/i, fallbackCount: 6 },
    { title: "Feature grid", pattern: /feature|card|tile|icon|badge/i, fallbackCount: 8 },
    { title: "Pricing, proof, and footer", pattern: /pricing|testimonial|logo|footer|card/i, fallbackCount: 6 },
  ],
  "Mobile app": [
    { title: "Mobile shell", pattern: /mobile|nav|tab|bar|header/i, fallbackCount: 4 },
    { title: "Content list", pattern: /card|item|row|list|avatar|badge/i, fallbackCount: 8 },
    { title: "Primary actions", pattern: /button|input|modal|toast|empty/i, fallbackCount: 6 },
  ],
  "AI workspace": [
    { title: "Conversation and sidebar", pattern: /chat|conversation|message|sidebar|nav/i, fallbackCount: 6 },
    { title: "Prompt composer", pattern: /prompt|input|textarea|button|select|model/i, fallbackCount: 6 },
    { title: "Response, sources, and actions", pattern: /response|source|citation|card|toolbar|button/i, fallbackCount: 8 },
  ],
  "Developer console": [
    { title: "Console shell", pattern: /nav|sidebar|toolbar|command|menu/i, fallbackCount: 6 },
    { title: "Resources and details", pattern: /table|list|row|card|panel|detail/i, fallbackCount: 8 },
    { title: "Logs and status", pattern: /log|code|terminal|status|badge|alert/i, fallbackCount: 6 },
  ],
  Dashboard: [
    { title: "Navigation and header", pattern: /nav|header|menu|tab|button/i, fallbackCount: 6 },
    { title: "KPI cards and charts", pattern: /metric|kpi|card|chart|graph|badge/i, fallbackCount: 8 },
    { title: "Data table and activity", pattern: /table|row|list|activity|feed|avatar/i, fallbackCount: 8 },
  ],
};
const OPEN_DESIGN_PRESETS: OpenDesignPreset[] = [
  {
    id: "default",
    label: "Neutral Modern",
    category: "Default",
    summary: "Balanced production UI with clear hierarchy, restrained accents, and broad component reuse.",
    tokens: ["semantic color roles", "4/8px spacing scale", "radius <= 8px", "subtle borders before shadows"],
    components: ["Button", "Input", "Select", "Tabs", "Table", "Modal", "Card", "Navigation"],
    guardrails: ["Keep layouts practical and scannable.", "Do not introduce a brand-specific visual language unless requested."],
  },
  {
    id: "linear-app",
    label: "Linear App",
    category: "Productivity & SaaS",
    summary: "Precise issue-tracking aesthetic: compact density, crisp borders, quiet surfaces, and fast keyboard-first workflows.",
    tokens: ["neutral surfaces", "low-contrast borders", "single focused accent", "tight spacing"],
    components: ["Command menu", "Issue row", "Status badge", "Sidebar", "Toolbar", "Activity feed"],
    guardrails: ["Favor density and speed over decorative presentation.", "Keep status, priority, and ownership easy to scan."],
  },
  {
    id: "openai",
    label: "OpenAI",
    category: "AI & LLM",
    summary: "Calm AI workspace with generous readable content, high trust, subtle interactions, and minimal distraction.",
    tokens: ["soft neutrals", "clear text hierarchy", "accessible focus", "subtle panel separation"],
    components: ["Prompt composer", "Conversation list", "Assistant response", "Model picker", "Citation block"],
    guardrails: ["Make generated or AI-assisted states explicit.", "Prioritize readable long-form content and safe action confirmation."],
  },
  {
    id: "cursor",
    label: "Cursor",
    category: "Developer Tools",
    summary: "Code-first tool UI with dark-ready surfaces, command palette behavior, split panes, and strong editor ergonomics.",
    tokens: ["editor background", "syntax-friendly accents", "compact controls", "panel dividers"],
    components: ["Command palette", "File tree", "Diff view", "Terminal panel", "Inline suggestion"],
    guardrails: ["Preserve monospace readability.", "Avoid marketing layouts inside work surfaces."],
  },
  {
    id: "stripe",
    label: "Stripe",
    category: "Fintech & Crypto",
    summary: "Polished fintech system: exact forms, trustworthy data presentation, strong docs, and confident conversion flows.",
    tokens: ["trustworthy blues", "semantic validation colors", "precise form spacing", "elevated docs surfaces"],
    components: ["Payment form", "Pricing table", "Metric card", "Docs sidebar", "Alert", "Checkout summary"],
    guardrails: ["Validation, security, and error states must be complete.", "Keep financial data legible and unambiguous."],
  },
  {
    id: "figma",
    label: "Figma",
    category: "Design & Creative",
    summary: "Creative tool language with canvas-first structure, compact toolbars, inspectable properties, and clear selection states.",
    tokens: ["canvas surface", "selection blue", "toolbar neutrals", "compact radius"],
    components: ["Toolbar", "Layer row", "Properties panel", "Canvas frame", "Inspector control"],
    guardrails: ["Make object state and selection visible.", "Keep controls compact without losing target clarity."],
  },
  {
    id: "notion",
    label: "Notion",
    category: "Productivity & SaaS",
    summary: "Document-product hybrid: calm typography, block composition, low chrome, and flexible information hierarchy.",
    tokens: ["paper surface", "muted text roles", "block spacing", "subtle hover states"],
    components: ["Block editor", "Page sidebar", "Database table", "Property pill", "Empty state"],
    guardrails: ["Do not over-frame content with cards.", "Let typography and block grouping carry hierarchy."],
  },
  {
    id: "github",
    label: "GitHub",
    category: "Developer Tools",
    summary: "Repository operations UI: dense lists, readable diffs, clear status badges, tabs, and durable enterprise patterns.",
    tokens: ["bordered surfaces", "status colors", "monospace code", "compact list spacing"],
    components: ["Repo nav", "Issue list", "Pull request row", "Code block", "Status check", "Diff panel"],
    guardrails: ["Keep code and audit trails readable.", "Represent status with text plus color, not color alone."],
  },
  {
    id: "apple",
    label: "Apple",
    category: "Media & Consumer",
    summary: "Premium consumer product direction with refined typography, restrained controls, and high-quality imagery.",
    tokens: ["premium neutrals", "large type scale", "spacious sections", "minimal chrome"],
    components: ["Product hero", "Feature tile", "Gallery", "Comparison table", "Sticky purchase bar"],
    guardrails: ["Use real product imagery or clear generated product visuals.", "Do not apply oversized hero treatment to dense admin tools."],
  },
  {
    id: "material",
    label: "Material",
    category: "Default",
    summary: "Systematic cross-platform UI with explicit states, accessible components, elevation rules, and responsive layouts.",
    tokens: ["semantic roles", "state layers", "elevation scale", "responsive breakpoints"],
    components: ["Button", "Text field", "Navigation rail", "Top app bar", "Dialog", "Data table"],
    guardrails: ["Expose hover, focus, pressed, selected, disabled, loading, and error states.", "Use elevation only for hierarchy or interaction."],
  },
];
const MODEL_TARGETS = ["Claude Code", "Codex", "Cursor", "Windsurf", "Figma Make"];
const DEFAULT_OWNER_NAME = "Do Minh Duc";
const DEFAULT_OWNER_CONTACT = "0962500635";
const MAX_EXPORT_COMPONENTS = 80;
const MAX_DETAILED_COMPONENTS = 24;
const MAX_EXPORT_VARIABLES = 160;
const PROMPT_PREVIEW_LIMIT = 2400;

const STARTER_COMPONENTS = [
  "Button",
  "Input",
  "Select",
  "Checkbox",
  "Radio",
  "Switch",
  "Badge",
  "Alert",
  "Modal",
  "Card",
  "Tabs",
  "Table",
  "Pagination",
  "Navigation",
];

const STARTER_MOLECULES: DesignSystemComponentInfo[] = [
  { id: "suggested-search-field", name: "SearchField", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "form" },
  { id: "suggested-form-field", name: "FormField", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "form" },
  { id: "suggested-filter-bar", name: "FilterBar", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "form" },
  { id: "suggested-table-row", name: "TableRow", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "table" },
  { id: "suggested-data-card", name: "DataCard", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "card" },
  { id: "suggested-dialog-header", name: "DialogHeader", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "modal" },
  { id: "suggested-notification-item", name: "NotificationItem", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "list" },
  { id: "suggested-user-menu", name: "UserMenu", type: "COMPONENT", pageName: "Suggested", source: "suggested", role: "navigation" },
];

const STARTER_VARIABLES: DesignSystemVariableInfo[] = [
  { id: "suggested-primary", name: "color/brand/primary", collectionName: "Suggested", modeName: "Light", resolvedType: "COLOR", value: "#0d99ff" },
  { id: "suggested-bg", name: "color/background/default", collectionName: "Suggested", modeName: "Light", resolvedType: "COLOR", value: "#ffffff" },
  { id: "suggested-text", name: "color/text/primary", collectionName: "Suggested", modeName: "Light", resolvedType: "COLOR", value: "#1f2328" },
  { id: "suggested-space-4", name: "space/4", collectionName: "Suggested", modeName: "Base", resolvedType: "FLOAT", value: "4" },
  { id: "suggested-space-8", name: "space/8", collectionName: "Suggested", modeName: "Base", resolvedType: "FLOAT", value: "8" },
  { id: "suggested-radius", name: "radius/default", collectionName: "Suggested", modeName: "Base", resolvedType: "FLOAT", value: "6" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "design-system";
}

function hasTargetModel(models: string[], model: string): boolean {
  return models.includes(model);
}

function classifyComponent(component: DesignSystemComponentInfo): "atoms" | "molecules" | "organisms" {
  const name = component.name.toLowerCase();
  if (/button|input|icon|badge|avatar|checkbox|radio|switch|label|text|tag/.test(name)) return "atoms";
  if (/card|field|form|item|row|tab|menu|modal|alert|toast|dropdown|select/.test(name)) return "molecules";
  return "organisms";
}

function groupComponents(components: DesignSystemComponentInfo[]) {
  return components.reduce(
    (groups, component) => {
      groups[classifyComponent(component)].push(component);
      return groups;
    },
    { atoms: [] as DesignSystemComponentInfo[], molecules: [] as DesignSystemComponentInfo[], organisms: [] as DesignSystemComponentInfo[] },
  );
}

function getComponentMappingKey(component: DesignSystemComponentInfo): string {
  return component.componentKey ?? component.nodeId ?? `${component.source ?? "unknown"}:${component.pageName}:${component.name}`;
}

function getTemplateSectionDefinitions(layoutTemplate: string): TemplateSectionDefinition[] {
  return TEMPLATE_SECTION_DEFINITIONS[layoutTemplate] ?? TEMPLATE_SECTION_DEFINITIONS.Dashboard;
}

function getSuggestedComponentForSection(section: TemplateSectionDefinition, components: DesignSystemComponentInfo[]): DesignSystemComponentInfo | null {
  return (
    components.find((component) => component.source !== "suggested" && component.role && section.pattern.test(component.role)) ??
    components.find((component) => component.source !== "suggested" && section.pattern.test(component.name)) ??
    components.find((component) => component.role && section.pattern.test(component.role)) ??
    components.find((component) => section.pattern.test(component.name)) ??
    null
  );
}

function buildTemplateComponentMappings(
  sections: TemplateSectionDefinition[],
  mappings: Record<string, string[]>,
): Record<string, string[]> {
  return sections.reduce<Record<string, string[]>>((acc, section) => {
    const values = mappings[section.title]?.filter(Boolean) ?? [];
    if (values.length > 0) acc[section.title] = values;
    return acc;
  }, {});
}

function withStarterMolecules(components: DesignSystemComponentInfo[], useStarter: boolean): DesignSystemComponentInfo[] {
  if (!useStarter) return components;
  const grouped = groupComponents(components);
  if (grouped.molecules.length > 0) return components;
  return [...components, ...STARTER_MOLECULES];
}

function formatComponentList(components: DesignSystemComponentInfo[]): string {
  if (components.length === 0) return "- No components in this group yet.\n";
  return components.slice(0, MAX_EXPORT_COMPONENTS)
    .map((component) => {
      const variants = component.variantProperties
        ? `\n  - Variants: ${Object.entries(component.variantProperties).slice(0, 6).map(([key, values]) => `${key}(${values.slice(0, 8).join(", ")})`).join("; ")}`
        : "";
      const desc = component.description ? `\n  - Description: ${component.description.slice(0, 180)}` : "";
      return `- ${component.name} (${component.type}, ${component.source ?? "unknown"}, role: ${component.role ?? "unknown"}, page: ${component.pageName})${variants}${desc}`;
    })
    .join("\n") + (components.length > MAX_EXPORT_COMPONENTS ? `\n- ... ${components.length - MAX_EXPORT_COMPONENTS} more components omitted. See component-manifest.json.` : "");
}

function componentDocAnchor(component: DesignSystemComponentInfo): string {
  return slugify(component.name);
}

function componentCodePath(component: DesignSystemComponentInfo): string {
  return `src/components/${componentDocAnchor(component)}/${component.name}.tsx`;
}

function componentStylePath(component: DesignSystemComponentInfo): string {
  return `src/components/${componentDocAnchor(component)}/${component.name}.module.css`;
}

function getComponentTokenCandidates(
  variables: DesignSystemVariableInfo[],
  limit = 12,
): DesignSystemVariableInfo[] {
  return variables
    .filter((variable) => {
      const name = variable.name.toLowerCase();
      return /color|background|surface|text|border|space|spacing|gap|padding|radius|shadow|elevation|font|type|motion|duration/i.test(name);
    })
    .slice(0, limit);
}

function formatRecommendedCodeEdits(component: DesignSystemComponentInfo): string {
  return [
    `- Create or update \`${componentCodePath(component)}\` with props mapped from Figma variants.`,
    `- Create or update \`${componentStylePath(component)}\` using tokens from \`design-system/tokens/tokens.css\`.`,
    `- Add Storybook stories for ${inferComponentStates(component).join(", ")} states and ${inferComponentSizes(component).join(", ")} sizes.`,
    "- Add tests for keyboard behavior, disabled/loading/error states, and variant class mapping.",
    "- If Code Connect is available, map the Figma node ID to this component path before implementation.",
  ].join("\n");
}

function formatComponentMcpMetadata(component: DesignSystemComponentInfo, variables: DesignSystemVariableInfo[]): string {
  const variants = Object.keys(component.variantProperties ?? {});
  const tokenCandidates = getComponentTokenCandidates(variables);

  return `### Figma MCP & Code Mapping
| Field | Value |
| --- | --- |
| Figma node ID | \`${component.id}\` |
| Local node ID | \`${component.nodeId ?? "n/a"}\` |
| Figma component key | \`${component.componentKey ?? "n/a"}\` |
| Figma page | ${component.pageName} |
| Source | ${component.source ?? "unknown"} |
| Role | ${component.role ?? "unknown"} |
| Suggested code path | \`${componentCodePath(component)}\` |
| Suggested style path | \`${componentStylePath(component)}\` |
| Claude/Codex editable | yes - edit the code component and tests using this spec |
| Figma MCP editable | yes when MCP has write access to this file/node; otherwise use this as read-only design truth |
| Code Connect target | map this Figma component to \`${component.name}\` at the suggested code path |

Variant props:
${variants.length > 0 ? variants.map((name) => `- ${name}: ${(component.variantProperties?.[name] ?? []).join(", ")}`).join("\n") : "- No synced variant props yet. Preserve existing Figma variants when discovered."}

Token dependencies:
${tokenCandidates.length > 0 ? tokenCandidates.map((variable) => `- ${variable.name}: ${variable.value}`).join("\n") : "- No direct token dependencies synced yet. Use tokens from design-system/tokens before raw values."}

Recommended code edits:
${formatRecommendedCodeEdits(component)}`;
}

function inferComponentUsage(component: DesignSystemComponentInfo): string {
  const name = component.name.toLowerCase();
  if (/button|action|cta/.test(name)) return "Use for primary, secondary, and destructive user actions.";
  if (/input|field|select|picker|dropdown|upload|form/.test(name)) return "Use inside data-entry flows, validation forms, and filter panels.";
  if (/table|row|cell|pagination/.test(name)) return "Use for dense operational data, lists, comparison, and admin workflows.";
  if (/card|tile|panel/.test(name)) return "Use to group related summary content, metrics, actions, or object previews.";
  if (/modal|dialog|drawer|toast|alert/.test(name)) return "Use for interruption, confirmation, feedback, and system messaging.";
  if (/nav|menu|breadcrumb|tabs|side/.test(name)) return "Use for navigation, hierarchy, page switching, and wayfinding.";
  if (/avatar|badge|tag|chip|icon/.test(name)) return "Use as supporting identity, status, metadata, or compact visual signals.";
  return "Use when this Figma component appears in the source design system or when an equivalent reusable UI pattern is needed.";
}

function inferComponentStates(component: DesignSystemComponentInfo): string[] {
  const variantText = Object.values(component.variantProperties ?? {}).flat().join(" ").toLowerCase();
  const base = ["default", "hover", "focus", "disabled"];
  const detected = ["active", "selected", "pressed", "loading", "empty", "error", "success", "warning"].filter((state) =>
    variantText.includes(state),
  );
  return Array.from(new Set([...base, ...detected]));
}

function inferComponentSizes(component: DesignSystemComponentInfo): string[] {
  const variantText = Object.values(component.variantProperties ?? {}).flat().join(" ").toLowerCase();
  const known = ["xs", "sm", "md", "lg", "xl", "small", "medium", "large"].filter((size) => variantText.includes(size));
  return known.length > 0 ? known : ["sm", "md", "lg"];
}

function inferIconConfiguration(component: DesignSystemComponentInfo): string {
  const name = component.name.toLowerCase();
  if (/button|input|field|select|dropdown|menu|tab|nav|alert|toast|upload/.test(name)) {
    return "- Optional leading icon\n- Optional trailing icon\n- Icons must use currentColor and inherit disabled/hover/focus states\n- Decorative icons must be aria-hidden; semantic icons need accessible labels";
  }
  if (/icon|avatar|badge|tag|chip/.test(name)) {
    return "- Icon-only variants require aria-label\n- Size must align to the component size scale\n- Use tokenized color roles, not hardcoded fills";
  }
  return "- No icon required by default\n- If added, icon placement must follow component family conventions";
}

function formatVariantProperties(component: DesignSystemComponentInfo): string {
  const entries = Object.entries(component.variantProperties ?? {});
  if (entries.length === 0) return "- No Figma variants synced. Define variants before implementation if states or sizes differ.";
  return entries.map(([name, values]) => `- ${name}: ${values.join(", ")}`).join("\n");
}

function formatComponentTokenGuidance(variables: DesignSystemVariableInfo[]): string {
  const colorTokens = variables.filter((variable) => variable.resolvedType === "COLOR").slice(0, 10);
  if (colorTokens.length === 0) {
    return "- Use `../tokens/variables.md` as the source of truth when tokens are available.\n- Do not introduce random hex values in component implementations.";
  }
  return [
    "- Use `../tokens/variables.md`, `../tokens/tokens.json`, and `../tokens/tokens.css` as the source of truth.",
    ...colorTokens.map((variable) => `- ${variable.name}: ${variable.value}`),
  ].join("\n");
}

function formatDetailedComponent(component: DesignSystemComponentInfo, variables: DesignSystemVariableInfo[]): string {
  return `## ${component.name}

Source: ${component.type} on ${component.pageName}
Anchor: ${componentDocAnchor(component)}

${formatComponentMcpMetadata(component, variables)}

### 1. Description & Usage
${component.description || "Synced from Figma. Add description in Figma to improve AI implementation accuracy."}

**When to use:**
${inferComponentUsage(component)}

### 2. Variants
${formatVariantProperties(component)}

### 3. Sizes
${inferComponentSizes(component).map((size) => `- ${size}`).join("\n")}

### 4. States
${inferComponentStates(component).map((state) => `- ${state}`).join("\n")}

### 5. Icon Configuration
${inferIconConfiguration(component)}

### 6. Color and Design Tokens
${formatComponentTokenGuidance(variables)}

### 7. File Structure Rules
- Component source: \`${componentCodePath(component)}\`
- Styles: \`${componentStylePath(component)}\` or project CSS convention
- Tests: \`src/components/${componentDocAnchor(component)}/${component.name}.test.tsx\`
- Story/docs: \`src/components/${componentDocAnchor(component)}/${component.name}.stories.tsx\`
- Export from component index and reuse tokens from \`design-system/tokens/tokens.css\`.

### 8. Accessibility Rules
- Keyboard focus must be visible.
- Interactive target should be at least 44px where touch is expected.
- Error and loading states must be announced when relevant.
- Do not rely on color alone for status.

### 9. Implementation Notes
- Keep Figma naming and variants aligned with code props.
- Prefer composition over one-off styles.
- Do not hardcode colors when token aliases exist.
`;
}

function formatDetailedComponents(components: DesignSystemComponentInfo[], variables: DesignSystemVariableInfo[]): string {
  if (components.length === 0) return "- No components synced from Figma.\n";
  const detailed = components.slice(0, MAX_DETAILED_COMPONENTS).map((component) => formatDetailedComponent(component, variables)).join("\n");
  return detailed + (components.length > MAX_DETAILED_COMPONENTS ? `\n\n## Omitted Components\n${components.length - MAX_DETAILED_COMPONENTS} components omitted from markdown detail to keep tokens low. Use component-manifest.json for the full machine-readable list.\n` : "");
}

function formatAllComponents(components: DesignSystemComponentInfo[]): string {
  if (components.length === 0) return "- No components have been synced from Figma yet.\n";

  const byPage = components.reduce((groups, component) => {
    const list = groups.get(component.pageName) ?? [];
    list.push(component);
    groups.set(component.pageName, list);
    return groups;
  }, new Map<string, DesignSystemComponentInfo[]>());

  return Array.from(byPage.entries())
    .map(([pageName, pageComponents]) => `## ${pageName}\n${formatComponentList(pageComponents)}`)
    .join("\n\n");
}

function formatComponentPages(snapshot: DesignSystemSnapshot | null): string {
  const pages = snapshot?.pages ?? [];
  if (pages.length === 0) return "- No pages have been synced from Figma yet.\n";
  return pages.map((page) => `- ${page.name}: ${page.componentCount} components`).join("\n");
}

function formatDiagnostics(snapshot: DesignSystemSnapshot | null): string {
  const diagnostics = snapshot?.diagnostics;
  if (!diagnostics) return "";
  return [
    `local components: ${diagnostics.localRegistryComponents}`,
    `local component sets: ${diagnostics.localRegistryComponentSets}`,
    `library components: ${diagnostics.libraryComponents}`,
    `library component sets: ${diagnostics.libraryComponentSets}`,
    `document components: ${diagnostics.documentComponents}`,
    `document component sets: ${diagnostics.documentComponentSets}`,
    `instances: ${diagnostics.instances}`,
    `resolved instances: ${diagnostics.resolvedInstanceComponents}`,
    ...diagnostics.errors.map((error) => `error: ${error}`),
  ].join("\n");
}

function formatVariables(variables: DesignSystemVariableInfo[]): string {
  if (variables.length === 0) return "- No variables synced yet. Use the starter proposal to create a baseline token foundation.\n";
  return variables.slice(0, MAX_EXPORT_VARIABLES)
    .map((variable) => `- ${variable.name}: ${variable.value} (${variable.resolvedType}, ${variable.collectionName}/${variable.modeName})`)
    .join("\n") + (variables.length > MAX_EXPORT_VARIABLES ? `\n- ... ${variables.length - MAX_EXPORT_VARIABLES} more variables omitted. See tokens.json for full compact source.` : "");
}

function tokenCssName(name: string): string {
  return `--${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function formatTokensJson(variables: DesignSystemVariableInfo[]): string {
  const tokens = variables.reduce<Record<string, { value: string; type: string; collection: string; mode: string }>>((acc, variable) => {
    acc[variable.name] = {
      value: variable.value,
      type: variable.resolvedType.toLowerCase(),
      collection: variable.collectionName,
      mode: variable.modeName,
    };
    return acc;
  }, {});
  return `${JSON.stringify(tokens, null, 2)}\n`;
}

function formatTokensCss(variables: DesignSystemVariableInfo[]): string {
  const lines = variables.map((variable) => {
    const value = variable.resolvedType === "FLOAT" && /^-?\d+(\.\d+)?$/.test(variable.value) ? `${variable.value}px` : variable.value;
    return `  ${tokenCssName(variable.name)}: ${value};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}

function formatColorTokens(variables: DesignSystemVariableInfo[]): string {
  const colors = variables.filter((variable) => variable.resolvedType === "COLOR").slice(0, MAX_EXPORT_VARIABLES);
  if (colors.length === 0) return "- No color tokens synced.\n";
  return colors.map((variable) => `- \`${tokenCssName(variable.name)}\`: ${variable.value} (${variable.name})`).join("\n");
}

function categoryScore(scanResult: ScanResult | null, id: string, fallback: number): number {
  const category = scanResult?.categories.find((item) => item.id === id);
  return Math.round((category?.score ?? fallback) / 10);
}

function hasVariable(variables: DesignSystemVariableInfo[], pattern: RegExp): boolean {
  return variables.some((variable) => pattern.test(variable.name) || pattern.test(variable.collectionName));
}

function buildUiAudit(
  scanResult: ScanResult | null,
  variables: DesignSystemVariableInfo[],
  components: DesignSystemComponentInfo[],
): UiCriterionScore[] {
  const tokenScore = categoryScore(scanResult, "tokens", variables.length > 0 ? 70 : 45);
  const structureScore = categoryScore(scanResult, "structure", components.length > 0 ? 70 : 45);
  const completenessScore = categoryScore(scanResult, "completeness", components.length > 0 ? 65 : 40);
  const variantsScore = categoryScore(scanResult, "variants", components.some((component) => component.variantProperties) ? 75 : 45);
  const metaScore = categoryScore(scanResult, "meta", 60);
  const hasTypography = hasVariable(variables, /font|type|text|line-height|letter/i);
  const hasSpacing = hasVariable(variables, /space|spacing|gap|padding|margin/i);
  const hasRadius = hasVariable(variables, /radius|corner/i);
  const hasShadow = hasVariable(variables, /shadow|elevation/i);
  const hasDark = hasVariable(variables, /dark|night|inverse/i);
  const componentFamilies = new Set(components.map((component) => component.name.split(/[\/\-_]/)[0]?.toLowerCase()).filter(Boolean));

  return [
    {
      id: "color-consistency",
      label: "Color consistency",
      score: tokenScore,
      rationale: variables.length > 0 ? "Uses Figma Variables as the source of color truth." : "No synced color variables were found; random hex usage risk is high.",
    },
    {
      id: "typography-hierarchy",
      label: "Typography hierarchy",
      score: hasTypography ? Math.max(7, metaScore) : Math.min(6, metaScore),
      rationale: hasTypography ? "Typography-related variables are present for hierarchy mapping." : "Typography tokens were not detected; h1/h2/body/caption hierarchy needs manual definition.",
    },
    {
      id: "spacing-rhythm",
      label: "Spacing rhythm",
      score: hasSpacing ? Math.max(7, tokenScore) : Math.min(6, tokenScore),
      rationale: hasSpacing ? "Spacing variables support a repeatable rhythm." : "Spacing scale variables were not detected; arbitrary spacing may remain.",
    },
    {
      id: "component-consistency",
      label: "Component consistency",
      score: Math.min(10, Math.max(4, Math.round((structureScore + Math.min(10, componentFamilies.size)) / 2))),
      rationale: `${components.length} components synced across ${componentFamilies.size} component families.`,
    },
    {
      id: "responsive-behavior",
      label: "Responsive behavior",
      score: variantsScore,
      rationale: variantsScore >= 7 ? "Responsive or variant coverage is strong enough for breakpoint guidance." : "Responsive variants/breakpoint guidance is incomplete.",
    },
    {
      id: "dark-mode",
      label: "Dark mode",
      score: hasDark ? 8 : 4,
      rationale: hasDark ? "Dark/inverse mode variables were detected." : "Dark mode variables were not detected; coverage is likely partial.",
    },
    {
      id: "animation",
      label: "Animation",
      score: hasVariable(variables, /duration|motion|ease|animation/i) ? 8 : 5,
      rationale: hasVariable(variables, /duration|motion|ease|animation/i) ? "Motion variables are available for purposeful animation." : "Motion tokens were not detected; keep animation conservative.",
    },
    {
      id: "accessibility",
      label: "Accessibility",
      score: Math.max(4, Math.round((metaScore + completenessScore) / 2)),
      rationale: "Estimated from metadata and completeness. Contrast, focus states, and touch targets should still be verified in implementation.",
    },
    {
      id: "information-density",
      label: "Information density",
      score: structureScore,
      rationale: structureScore >= 7 ? "Structure suggests content can remain scannable." : "Structure score indicates density and hierarchy need cleanup.",
    },
    {
      id: "polish",
      label: "Polish",
      score: Math.max(4, Math.round((completenessScore + variantsScore + (hasRadius || hasShadow ? 8 : 5)) / 3)),
      rationale: hasRadius || hasShadow ? "Radius/shadow tokens plus variants support polished states." : "Hover, transitions, loading, and empty states need explicit documentation.",
    },
  ];
}

function formatUiAudit(criteria: UiCriterionScore[]): string {
  const average = Math.round((criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length) * 10) / 10;
  const rows = criteria.map((item) => `| ${item.label} | ${item.score}/10 | ${item.rationale} |`);
  return `Overall UI quality score: ${average}/10

| Criterion | Score | Rationale |
| --- | ---: | --- |
${rows.join("\n")}`;
}

function buildReadinessScores(
  variables: DesignSystemVariableInfo[],
  components: DesignSystemComponentInfo[],
  uiAudit: UiCriterionScore[],
) {
  const componentCoverage = components.length > 0 ? 1 : 0;
  const variantCoverage = components.length > 0
    ? components.filter((component) => component.variantProperties && Object.keys(component.variantProperties).length > 0).length / components.length
    : 0;
  const tokenCoverage = variables.length > 0 ? 1 : 0;
  const averageUiScore = uiAudit.reduce((sum, item) => sum + item.score, 0) / uiAudit.length;

  return {
    mcpReadiness: Math.round((componentCoverage * 40 + tokenCoverage * 25 + variantCoverage * 20 + Math.min(1, averageUiScore / 10) * 15)),
    codeConnectReadiness: Math.round((componentCoverage * 35 + variantCoverage * 25 + tokenCoverage * 20 + Math.min(1, components.length / 12) * 20)),
    aiAgentReadiness: Math.round((Math.min(1, averageUiScore / 10) * 35 + tokenCoverage * 25 + componentCoverage * 25 + variantCoverage * 15)),
  };
}

function formatReadinessScores(scores: ReturnType<typeof buildReadinessScores>): string {
  return `## Agent Readiness Scores
| Score | Value | Meaning |
| --- | ---: | --- |
| MCP readiness | ${scores.mcpReadiness}/100 | How ready this export is for Figma MCP read/write workflows |
| Code Connect readiness | ${scores.codeConnectReadiness}/100 | How ready components are to map Figma nodes to code components |
| AI agent readiness | ${scores.aiAgentReadiness}/100 | How complete the context is for Claude, Codex, Cursor, and Windsurf |

Minimum target: keep every readiness score at 80+ before expecting reliable autonomous implementation.`;
}

function formatOpenDesignPreset(preset: OpenDesignPreset): string {
  return [
    `Open Design preset: ${preset.label}`,
    `Category: ${preset.category}`,
    `Direction: ${preset.summary}`,
    `Token emphasis: ${preset.tokens.join(", ")}.`,
    `Component emphasis: ${preset.components.join(", ")}.`,
    "Guardrails:",
    ...preset.guardrails.map((rule) => `- ${rule}`),
  ].join("\n");
}

function buildAiPrompt(projectName: string, industry: string, style: string, preset: OpenDesignPreset, models: string[], root: string): string {
  const requiredReading = [
    hasTargetModel(models, "Claude Code") ? `1. ${root}/CLAUDE.md` : "",
    hasTargetModel(models, "Codex") ? `2. ${root}/AGENTS.md` : "",
    `3. ${root}/design.md`,
    `4. ${root}/design-system/tokens/variables.md`,
    `5. ${root}/design-system/components/atoms.md`,
    `6. ${root}/design-system/components/molecules.md`,
    `7. ${root}/design-system/components/organisms.md`,
    `8. ${root}/design-system/code-connect.md`,
    `9. ${root}/design-system/component-manifest.json`,
    hasTargetModel(models, "Cursor") ? `10. ${root}/.cursor/rules/design-system.mdc` : "",
    hasTargetModel(models, "Windsurf") ? `11. ${root}/.windsurf/rules/design-system.md` : "",
    hasTargetModel(models, "Figma Make") ? `12. ${root}/design-system/figma/make.md` : "",
  ].filter(Boolean);
  const figmaMakeInstructions = hasTargetModel(models, "Figma Make")
    ? [
        "",
        "Figma Make instructions:",
        "- Read design-system/figma/make.md before generating UI.",
        "- Use Figma Variables names exactly as token names.",
        "- Preserve component hierarchy, variants, states, spacing, radius, typography, and layout direction.",
        "- Generate editable UI from the design system source, not a marketing mockup.",
      ]
    : [];

  return [
    `You are working on the ${projectName} Figma design system.`,
    `Use ${root}/ as the source of truth for ${models.join(", ")}.`,
    `Domain: ${industry}. Visual direction: ${style}. Target agents: ${models.join(", ")}.`,
    `Use the Open Design preset "${preset.label}" as inspiration only; Figma variables and synced components remain the source of truth.`,
    `Owner: ${DEFAULT_OWNER_NAME}. Contact: ${DEFAULT_OWNER_CONTACT}.`,
    "",
    formatOpenDesignPreset(preset),
    "",
    "Before editing code, read:",
    ...requiredReading,
    "",
    "When Figma changes, ask for a fresh DesignReady export and update only the affected markdown files.",
    "Preserve existing decisions, append new components, and request confirmation before renaming or deleting tokens.",
    ...figmaMakeInstructions,
    "",
    "UI quality gate:",
    "- Score every generated interface from 0 to 10 on color consistency, typography hierarchy, spacing rhythm, component consistency, responsive behavior, dark mode, animation, accessibility, information density, and polish.",
    "- Fix any criterion below 7 before delivery.",
  ].join("\n");
}

function formatImageBehavior(): string {
  return `## Image Behavior
| Use case | Behavior | Constraint |
| --- | --- | --- |
| Product or object hero | Use real product, UI, place, or generated bitmap imagery that clearly shows the subject | Avoid vague atmospheric backgrounds |
| Empty states | Use restrained illustration only when it clarifies the missing content | Do not let artwork dominate operational UI |
| Avatars and logos | Preserve source aspect ratio and provide fallback initials or neutral placeholders | Never stretch images |
| Cards and previews | Use stable aspect ratios and object-fit rules | Content must not resize layout on load |
| Data or dashboards | Prefer charts, screenshots, or real UI previews over decorative imagery | Keep labels readable |

Rules:
- Define width, height, aspect ratio, and loading fallback for every image slot.
- Keep important subject matter uncropped at mobile and desktop breakpoints.
- Use alt text for meaningful images and empty alt text for decorative images.
- Avoid dark, blurred, heavily cropped, or stock-like media when users need to inspect details.`;
}

function formatCollapsingStrategy(): string {
  return `## Collapsing Strategy
| Pattern | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Navigation | Collapse to drawer, bottom nav, or compact menu | Allow rail or segmented tabs | Full nav when space allows |
| Toolbars | Wrap low-priority actions into overflow menu | Keep primary actions visible | Show grouped actions |
| Tables | Use horizontal scroll, column priority, or card transform | Restore key columns | Full data grid |
| Forms | Single column with full-width controls | Two columns only when labels remain readable | Group related fields |
| Cards | One column | Two columns when content is comparable | Grid or split layout |

Rules:
- Primary action remains visible at every breakpoint.
- Collapsed content must remain discoverable through a clear icon, label, or menu affordance.
- Do not hide validation, pricing, status, or destructive-action context behind unclear overflow menus.
- Test long text, empty states, and error states after collapse.`;
}

function formatTouchTargets(): string {
  return `## Touch Targets
| Target | Minimum | Preferred | Notes |
| --- | ---: | ---: | --- |
| Primary buttons | 40px | 44-48px | Use 44px+ for mobile and frequent actions |
| Icon buttons | 36px | 40-44px | Icon can be 16-20px inside larger hit area |
| Form controls | 40px | 44px | Labels and error text must stay connected |
| List rows | 40px | 48px | Dense desktop rows may be smaller when not touch-first |
| Tabs and chips | 32px | 36-40px | Maintain enough horizontal padding |

Rules:
- Keep at least 8px separation between adjacent touch targets.
- Do not rely on tiny text links for frequent mobile actions.
- Focus outlines must fit inside or around the target without being clipped.
- Icon-only controls need accessible labels and tooltips when meaning is not obvious.`;
}

function formatDosAndDonts(): string {
  return `## Do's and Don'ts
| Do | Don't |
| --- | --- |
| Use semantic design tokens before raw CSS values | Scatter random hex, px, radius, or shadow values |
| Reuse documented components and variants | Create one-off UI that duplicates existing patterns |
| Keep operational screens dense but scannable | Turn dashboards into oversized marketing layouts |
| Verify mobile, tablet, desktop, empty, loading, and error states | Ship only the happy path |
| Preserve Figma hierarchy and naming intent | Flatten everything into anonymous divs |
| Use purposeful motion for feedback and spatial continuity | Add decorative animation that slows workflows |
| Keep cards for repeated items, modals, and framed tools | Put page sections inside floating card shells |
| Document deviations from Figma | Silently change spacing, hierarchy, or color meaning |`;
}

function formatDepthElevationGuidelines(variables: DesignSystemVariableInfo[]): string {
  const elevationTokens = variables.filter((variable) => /shadow|elevation|depth|overlay|blur/i.test(variable.name));
  const tokenLines = elevationTokens.length > 0
    ? [
        "| Token | Value | Usage |",
        "| --- | --- | --- |",
        ...elevationTokens.slice(0, 16).map((variable) => `| \`${variable.name}\` | ${variable.value} | Synced from Figma |`),
      ].join("\n")
    : "- No depth/elevation variables synced yet. Use the baseline elevation table below until Figma variables are added.";

  return `## Depth & Elevation
| Layer | Elevation | Usage |
| --- | --- | --- |
| Base | none | Main page and stable surfaces |
| Raised | subtle border or low shadow | Cards, selectable rows, toolbar groups |
| Floating | medium shadow | Popovers, dropdowns, floating toolbars |
| Modal | strong shadow plus overlay | Dialogs and blocking decisions |
| Toast | medium shadow | Temporary feedback above content |

Rules:
- Use borders and background contrast before heavy shadow in dense product UI.
- Elevation must communicate interaction or hierarchy, not decoration.
- Overlays should dim or separate the page without reducing text contrast below accessibility targets.
- Do not stack multiple heavy shadows inside the same local area.

### Synced Elevation Tokens
${tokenLines}`;
}

function formatLayoutPrinciples(variables: DesignSystemVariableInfo[]): string {
  return `## Layout Principles

### Border Radius Scale
| Token | Value (px) | Usage |
| --- | ---: | --- |
| \`radius-0\` | 0 | Flush edges, tables, dividers |
| \`radius-1\` | 2 | Tiny controls and badges |
| \`radius-2\` | 4 | Inputs, chips, compact buttons |
| \`radius-3\` | 6 | Default controls and cards |
| \`radius-4\` | 8 | Larger cards, panels, modals |
| \`radius-full\` | 999 | Pills, avatars, circular controls |

Rules:
- Default card radius should stay at 8px or less unless the source design system requires more.
- Use larger radius only for intentional friendly or consumer-facing surfaces.
- Keep sibling components on the same radius family.

### Whitespace Philosophy
| Space type | Intent | Rule |
| --- | --- | --- |
| Micro | Separate icons, labels, counters, and inline metadata | Use 4-8px |
| Component | Separate control internals and neighboring controls | Use 8-16px |
| Group | Separate related fields, rows, filters, and card content | Use 16-24px |
| Section | Separate major regions | Use 32-48px |
| Hero | Create emphasis without hiding following content | Use 48-64px carefully |

Rules:
- Whitespace should clarify hierarchy, not inflate the interface.
- Dense workflows can be compact, but labels, values, and actions must remain readable.
- Keep repeated rows and cards rhythmically consistent.

### Grid & Container
| Container | Width | Usage |
| --- | ---: | --- |
| compact | 640px | Forms, settings, focused editors |
| content | 960px | Documentation, readable pages |
| product | 1200px | Dashboards, tables, operational screens |
| wide | 1440px | Analytics, canvas, multi-pane tools |
| full | 100% | App shells, boards, maps, editors |

Rules:
- Use grid tracks, minmax, and wrapping rules instead of fragile fixed widths.
- Keep main content aligned to a predictable container unless the product surface needs full-bleed interaction.
- Avoid nested cards and floating page sections.
- Fixed-format UI such as boards, icon buttons, counters, and tiles need stable dimensions.

${formatSpacingGuidelines(variables, "### Spacing System")}`;
}

function formatVisualThemeAtmosphere(): string {
  return `## Visual Theme & Atmosphere
| Dimension | Direction | Guardrail |
| --- | --- | --- |
| Tone | Clear, production-ready, and work-focused | Avoid novelty styling that weakens usability |
| Color | Semantic roles with restrained accent use | Avoid one-note palettes and random decorative gradients |
| Density | Compact enough for repeated workflows | Avoid oversized hero-style composition in operational tools |
| Texture | Clean surfaces, borders, and purposeful contrast | Avoid decorative blobs, bokeh, or unrelated ornaments |
| Motion | Fast feedback and spatial continuity | Respect reduced motion |
| Brand | Visible through tokens, components, and content hierarchy | Do not rely only on a tiny logo or nav label |

Rules:
- The first viewport should reveal the product, object, workflow, or brand context immediately.
- Use real content density when designing SaaS, CRM, admin, dashboard, or enterprise surfaces.
- Favor quiet hierarchy, stable controls, and readable comparisons over decorative presentation.
- Visual polish comes from alignment, state coverage, typography, and token discipline.`;
}

function formatLayoutStructureGuidelines(components: DesignSystemComponentInfo[]): string {
  const grouped = groupComponents(components);
  return `## Layout Structure
- Use the Figma hierarchy as the implementation hierarchy: atoms compose molecules, molecules compose organisms, organisms compose screens.
- Prefer Auto Layout semantics in code: horizontal frames become rows, vertical frames become columns, and spacing maps to tokenized gap values.
- Keep page regions explicit: header, navigation, main content, aside, footer, modal, and toast/live regions should use semantic landmarks where applicable.
- Avoid absolute positioning for normal product UI. Reserve it for overlays, anchored popovers, decorative layers, or source Figma layers that cannot be expressed with flow layout.
- Keep repeated content as reusable components, not duplicated markup.

### Current Component Structure
- Atoms: ${grouped.atoms.length}
- Molecules: ${grouped.molecules.length}
- Organisms: ${grouped.organisms.length}`;
}

function formatTypographyGuidelines(variables: DesignSystemVariableInfo[]): string {
  const typographyTokens = variables.filter((variable) => /font|type|text|line-height|letter|weight|heading|body|caption/i.test(variable.name));
  const tokenLines = typographyTokens.length > 0
    ? [
        "| Token | Value | Usage |",
        "| --- | --- | --- |",
        ...typographyTokens.slice(0, 16).map((variable) => `| \`${variable.name}\` | ${variable.value} | Typography role from Figma |`),
      ].join("\n")
    : "- No typography variables synced yet. Define heading, body, caption, line-height, and font-weight tokens before implementation.";

  return `## Typography
| Role | Size | Line height | Usage |
| --- | ---: | ---: | --- |
| display | 40-56px | 1.05-1.15 | Landing or major product headers only |
| h1 | 32-40px | 1.1-1.2 | Page title |
| h2 | 24-32px | 1.15-1.25 | Section title |
| h3 | 20-24px | 1.2-1.3 | Panel or card heading |
| body | 16px | 1.4-1.6 | Default reading text |
| body-small | 14px | 1.35-1.5 | Dense UI text |
| caption | 12px | 1.3-1.45 | Metadata and helper text |
| label | 12-14px | 1.2-1.35 | Form labels and compact controls |

Rules:
- Use a clear type scale with roles for display, h1, h2, h3, body, body-small, caption, and label text.
- Keep body copy readable: default body text should not go below 16px unless the component is dense enterprise UI with proven readability.
- Use unitless line-height where possible; target 1.35-1.6 for reading text and tighter values only for compact labels or controls.
- Do not use negative letter spacing. Keep letter spacing at 0 unless the Figma token explicitly says otherwise.
- Preserve text truncation rules from Figma and expose long-content states in code.

### Synced Typography Tokens
${tokenLines}`;
}

function formatSpacingGuidelines(variables: DesignSystemVariableInfo[], heading = "## Spacing (Spacing Scale)"): string {
  const spacingTokens = variables.filter((variable) => /space|spacing|gap|padding|margin/i.test(variable.name));
  const tokenLines = spacingTokens.length > 0
    ? [
        "| Token | Value | Usage |",
        "| --- | ---: | --- |",
        ...spacingTokens.slice(0, 24).map((variable) => `| \`${variable.name}\` | ${variable.value} | Synced from Figma |`),
      ].join("\n")
    : "- No spacing variables synced yet. Use the baseline scale below until Figma variables are added.";

  return `${heading}
| Token | Value (px) | Usage |
| --- | ---: | --- |
| \`space-0\` | 0 | No gap / reset |
| \`space-1\` | 4 | Tiny gaps |
| \`space-2\` | 8 | Default padding |
| \`space-3\` | 12 | Compact controls |
| \`space-4\` | 16 | Standard spacing |
| \`space-5\` | 20 | Form elements |
| \`space-6\` | 24 | Section spacing |
| \`space-8\` | 32 | Large containers |
| \`space-10\` | 40 | Extra large spacing |
| \`space-12\` | 48 | Page sections |
| \`space-16\` | 64 | Hero / large gaps |

Rules:
- Use spacing tokens before raw pixel values.
- Component internals should usually use 4, 8, 12, or 16.
- Section and page spacing should usually use 24, 32, 40, 48, or 64.
- Keep spacing consistent within a component family. If one Button size uses 8px vertical padding and 12px horizontal padding, sibling variants should scale predictably.
- Avoid one-off spacing values unless they are copied directly from Figma and documented as intentional.

### Synced Spacing Tokens
${tokenLines}`;
}

function formatResponsiveGuidelines(components: DesignSystemComponentInfo[]): string {
  const responsiveComponents = components.filter((component) => /mobile|tablet|desktop|responsive|breakpoint|nav|table|grid|card|modal|drawer|sidebar/i.test(component.name));
  const componentLines = responsiveComponents.length > 0
    ? [
        "| Component | Mobile | Tablet | Desktop |",
        "| --- | --- | --- | --- |",
        ...responsiveComponents.slice(0, 20).map((component) => `| ${component.name} | Stack or simplify | Use adaptive columns | Match full Figma layout |`),
      ].join("\n")
    : "- No explicit responsive component names were detected. Treat every organism and layout component as responsive by default.";

  return `## Responsive

### Rules
- Design and verify mobile first, then tablet, then desktop.
- Components must resize without text overlap, clipped controls, or hidden primary actions.
- Prefer fluid widths, min/max constraints, wrapping, and container queries where the codebase supports them.
- Avoid viewport-scaled font sizes. Use typography tokens and stable component dimensions.
- Tables, charts, and dense data views need an explicit small-screen strategy: column priority, horizontal scroll, card transform, or summary-first layout.

### Components Responsive Behavior
${componentLines}

### Breakpoints
| Token | Width | Intent |
| --- | ---: | --- |
| xs | 320px | Small phones and constrained plugin/embedded views |
| sm | 375px | Standard mobile baseline |
| md | 768px | Tablet portrait and two-column opportunities |
| lg | 1024px | Tablet landscape and compact desktop |
| xl | 1280px | Desktop baseline |
| 2xl | 1440px | Wide desktop |

### Verification
- Check every generated screen at 375px, 768px, 1024px, 1280px, and 1440px.
- Confirm navigation, forms, modals, tables, cards, and empty/error/loading states at each breakpoint.`;
}

function formatAccessibilityGuidelines(): string {
  return `## Accessibility (WCAG 2.2 AA)
| Area | Requirement | WCAG target |
| --- | --- | --- |
| Contrast | 4.5:1 normal text, 3:1 large text and meaningful UI graphics | 1.4.3 / 1.4.11 |
| Keyboard | Every interactive element is reachable and usable by keyboard | 2.1.1 |
| Focus | Focus indicator is visible and not obscured | 2.4.7 / 2.4.11 |
| Target size | Minimum 24px target, 44px preferred for mobile/frequent actions | 2.5.8 |
| Semantics | Use buttons, links, labels, fieldsets, and landmarks correctly | 1.3.1 / 4.1.2 |
| Color | Do not rely on color alone for status or validation | 1.4.1 |
| Errors | Identify the field, explain the fix, and announce changes | 3.3.1 / 3.3.3 |
| Motion | Respect reduced-motion preferences | 2.3.3 |

Rules:
- Loading, empty, success, warning, and error states must have accessible names or live-region announcements when user action depends on them.
- Modal, drawer, popover, and menu components must manage focus and restore focus after close.`;
}

function formatDesignDecisionsMd(args: {
  projectName: string;
  industry: string;
  style: string;
  preset: OpenDesignPreset;
  uiAudit: UiCriterionScore[];
  readinessScores: ReturnType<typeof buildReadinessScores>;
  variables: DesignSystemVariableInfo[];
  components: DesignSystemComponentInfo[];
}): string {
  const grouped = groupComponents(args.components);
  const sourceCounts = args.components.reduce<Record<string, number>>((counts, component) => {
    const source = component.source ?? "unknown";
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});

  return `# ${args.projectName} Design Decisions

## Purpose
This is the compact rulebook for AI agents. Keep this file short. Use the linked manifest and reports for full component data.

## Read Order
| Order | File | Use for |
| ---: | --- | --- |
| 1 | \`design.md\` | Project rules, quality gates, and agent workflow |
| 2 | \`design-system/component-manifest.json\` | Full machine-readable component map |
| 3 | \`design-system/code-connect.md\` | Figma node/key to code component mapping |
| 4 | \`design-system/component-diff.md\` | Missing metadata and implementation gaps |
| 5 | \`design-system/tokens/tokens.css\` | CSS custom properties for implementation |
| 6 | \`design-system/figma/make.md\` | Figma Make generation contract |

## Project Direction
| Field | Value |
| --- | --- |
| Industry | ${args.industry} |
| Design style | ${args.style} |
| Open Design preset | ${args.preset.label} |
| Components | ${args.components.length} total |
| Variables | ${args.variables.length} exported |

## Component Source Summary
| Source | Count | Rule |
| --- | ---: | --- |
| local/document/instance | ${(sourceCounts.local ?? 0) + (sourceCounts.document ?? 0) + (sourceCounts.instance ?? 0)} | Can use local Figma node IDs |
| library | ${sourceCounts.library ?? 0} | Import with component keys |
| suggested | ${sourceCounts.suggested ?? 0} | Placeholder only until real Figma components exist |
| unknown | ${sourceCounts.unknown ?? 0} | Review before automation |

## Atomic Structure
| Level | Count | Source |
| --- | ---: | --- |
| Atoms | ${grouped.atoms.length} | \`design-system/components/atoms.md\` |
| Molecules | ${grouped.molecules.length} | \`design-system/components/molecules.md\` |
| Organisms | ${grouped.organisms.length} | \`design-system/components/organisms.md\` |

${formatReadinessScores(args.readinessScores)}

## UI Quality Gate
${formatUiAudit(args.uiAudit)}

## Agent Rules
| Area | Rule |
| --- | --- |
| Source of truth | Use \`component-manifest.json\` for full component data. Markdown component files are compact summaries. |
| Components | Prefer real components with \`source: local\`, \`document\`, \`instance\`, or \`library\`. Treat \`suggested\` as placeholders only. |
| Tokens | Use \`tokens.css\` and \`tokens.json\` before raw values. Do not invent random hex, px, radius, shadow, typography, or motion values. |
| Code Connect | Use local node IDs for local/document components and component keys for library imports. |
| MCP | Read mode may inspect any manifest node. Write mode may only edit listed nodes when explicitly requested. |
| Accessibility | Ship keyboard access, visible focus, labels, error states, non-color-only status, and WCAG 2.2 AA contrast. |
| Responsive | Verify 375, 768, 1024, 1280, and 1440px. No clipped text, overlapped controls, or hidden primary actions. |
| States | Cover default, hover, focus, pressed, selected, disabled, loading, empty, and error states where relevant. |

## Open Design Direction
${formatOpenDesignPreset(args.preset)}

## Implementation Checklist
| Step | Check |
| ---: | --- |
| 1 | Read \`component-manifest.json\` and identify real vs suggested components. |
| 2 | Read \`component-diff.md\` and fix missing metadata or variant gaps first. |
| 3 | Map Figma components to code paths from \`code-connect.md\`. |
| 4 | Implement atoms, then molecules, then organisms. |
| 5 | Use tokens from \`tokens.css\`; document any intentional raw values. |
| 6 | Add stories/tests for variants, states, accessibility, and responsive behavior. |
| 7 | Re-run DesignReady after Figma component or token changes. |

## Do / Don't
| Do | Don't |
| --- | --- |
| Use semantic tokens and documented components | Hardcode visual values or duplicate component logic |
| Keep operational screens dense but scannable | Turn product UI into oversized marketing layouts |
| Preserve Figma hierarchy and naming intent | Flatten everything into anonymous one-off markup |
| Verify mobile, tablet, desktop, empty, loading, and error states | Ship only the happy path |
| Document intentional deviations from Figma | Silently change spacing, hierarchy, or token meaning |
`;
}

function formatSyncDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMakeIconRules(components: DesignSystemComponentInfo[]): string {
  const icons = components
    .filter((component) => /icon|arrow|add|alert|analytics|activity|camera|card|bookmark|calendar|bin|delete|close|cancel/i.test(component.name))
    .map((component) => component.name)
    .sort((a, b) => a.localeCompare(b));
  const iconList = icons.length > 0 ? icons.join(", ") : "No synced icon components detected yet. Apply these rules to every icon added later.";

  return `### 4.1 Icons (Atom)
Universal icon rules:
- Sizes: sm (16px), md (20px), lg (24px).
- States: default, hover, focus, disabled.
- Color: use \`currentColor\` plus semantic icon tokens such as \`color.icon.default\`, \`color.icon.primary\`, \`color.icon.success\`, \`color.icon.warning\`, and \`color.icon.danger\`.
- Accessibility: use \`aria-hidden="true"\` for decorative icons; require \`aria-label\` for interactive or icon-only controls.
- Implementation: prefer inline SVG or the project icon system so icons inherit color and state.

Synced icon candidates:
${iconList}`;
}

function formatMakeComponentRule(component: DesignSystemComponentInfo): string {
  return `### ${component.name}
- Figma node ID: \`${component.id}\`
- Suggested code path: \`${componentCodePath(component)}\`
- Claude/Codex editable: yes
- Figma MCP editable: yes when MCP has write access to this node
- Variants:
${formatVariantProperties(component)}
- Sizes: ${inferComponentSizes(component).join(", ")}
- States: ${inferComponentStates(component).join(", ")}
- File: \`${componentCodePath(component)}\`
- Usage: ${inferComponentUsage(component)}`;
}

function formatMakeGlobalComponentRules(components: DesignSystemComponentInfo[]): string {
  const priorityComponents = components
    .filter((component) => /toggle|switch|tooltip|top.?nav|navigation|button|input|select|table|modal|dialog|card|tabs/i.test(component.name))
    .slice(0, 10);
  const componentRules =
    priorityComponents.length > 0
      ? priorityComponents.map(formatMakeComponentRule).join("\n\n")
      : "No synced priority components detected yet. Start with Button, Input, Select, Toggle, Tooltip, Navigation, Table, Modal, Card, and Tabs when they appear in Figma.";

  return `## 4. Global Component Rules

${formatMakeIconRules(components)}

${componentRules}`;
}

function formatSharedModelRules(args: { uiAudit: UiCriterionScore[]; components: DesignSystemComponentInfo[] }): string {
  return `## Shared AI Operating Rules

### 1. Project Identity & Core Principles
- Strictly follow Atomic Design: Atoms -> Molecules -> Organisms -> Templates -> Screens.
- Use tokens from \`design-system/tokens/tokens.json\` and \`design-system/tokens/tokens.css\` before any raw design value.
- Treat Figma Variables and Modes as the source of truth for Light/Dark support.
- Preserve Figma names where possible. Use kebab-case for folders/files and PascalCase for React components.
- Map Auto Layout to implementation layout: horizontal frames become rows and vertical frames become columns.
- Avoid absolute positioning unless the source layer or overlay behavior requires it.

### 2. Generation Rules
- Generate from synced Figma components, variants, variables, and documented component rules.
- Keep files, frames, layers, and components named clearly.
- Include every available state: \`default\`, \`hover\`, \`focus\`, \`pressed\`, \`selected\`, \`disabled\`, \`loading\`, \`error\`, and \`empty\`.
- Visible focus states, accessible labels, and non-color-only status communication are required.
- Keep motion conservative; use motion tokens first.
- Use tokens plus CSS Modules or the project styling convention. Do not place raw design values in inline styles.

### 3. Token Usage Rules (Anti Token Explosion)
Priority order:
1. Semantic tokens, for example \`color.background.default\`, \`color.text.primary\`, and \`space.md\`.
2. Primitive tokens only when a semantic token does not exist.
3. Component tokens only when more than three components share the same special value or a component contract truly needs it.

Rules:
- Maximize token aliases.
- Never duplicate token values.
- Check \`tokens.json\` before creating or renaming tokens.
- Keep component-specific tokens minimal.
- Do not introduce random hex, px, radius, shadow, z-index, typography, or motion values.

${formatMakeGlobalComponentRules(args.components)}

### 5. UI Quality Gate Targets
${formatUiAudit(args.uiAudit)}

Minimum targets:
- Color consistency: >= 9/10
- Typography hierarchy: >= 9/10
- Spacing rhythm: >= 9/10
- Component consistency: 10/10
- Accessibility: >= 9/10
- Information density: 10/10 for enterprise systems
- Dark mode support: >= 9/10

### 6. Strict Instructions for AI
Follow this order every time:
1. Read project identity and core principles.
2. Read generation rules.
3. Read token usage rules.
4. Read relevant global component rules.
5. Check and use only existing tokens from the tokens folder.
6. Follow Atomic Design composition rules.
7. Generate all defined variants and states.
8. Ensure full accessibility and dark mode compatibility.

Prohibited:
- Hardcoding design values.
- Duplicating components or logic.
- Skipping states or accessibility requirements.
- Using inline styles instead of tokens plus CSS Modules or the project styling convention.`;
}

function buildComponentManifest(args: {
  projectName: string;
  industry: string;
  style: string;
  preset: OpenDesignPreset;
  models: string[];
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  uiAudit: UiCriterionScore[];
  readinessScores: ReturnType<typeof buildReadinessScores>;
}) {
  return {
    schemaVersion: 1,
    generatedBy: "DesignReady AI",
    generatedAt: formatSyncDate(),
    project: {
      name: args.projectName,
      owner: DEFAULT_OWNER_NAME,
      contact: DEFAULT_OWNER_CONTACT,
      industry: args.industry,
      style: args.style,
      openDesignPreset: args.preset.label,
      targetAgents: args.models,
    },
    readiness: args.readinessScores,
    uiAudit: args.uiAudit,
    tokenCandidates: getComponentTokenCandidates(args.variables, 24).map((variable) => ({
      name: variable.name,
      value: variable.value,
      type: variable.resolvedType,
      collection: variable.collectionName,
      mode: variable.modeName,
    })),
    components: args.components.map((component) => ({
      id: component.id,
      figmaNodeId: component.nodeId ?? null,
      figmaComponentKey: component.componentKey ?? null,
      name: component.name,
      type: component.type,
      pageName: component.pageName,
      source: component.source ?? "unknown",
      role: component.role ?? "unknown",
      atomicLevel: classifyComponent(component),
      codePath: componentCodePath(component),
      stylePath: componentStylePath(component),
      testPath: `src/components/${componentDocAnchor(component)}/${component.name}.test.tsx`,
      storyPath: `src/components/${componentDocAnchor(component)}/${component.name}.stories.tsx`,
      variants: component.variantProperties ?? {},
      states: inferComponentStates(component),
      sizes: inferComponentSizes(component),
      editable: {
        code: true,
        figmaMcp: "requires-write-access",
        codeConnect: "recommended",
      },
      recommendedCodeEdits: formatRecommendedCodeEdits(component).split("\n").map((line) => line.replace(/^- /, "")),
    })),
  };
}

function buildComponentDiffItems(components: DesignSystemComponentInfo[], variables: DesignSystemVariableInfo[]) {
  const hasTokens = variables.length > 0;
  return components.map((component) => {
    const variants = Object.keys(component.variantProperties ?? {});
    const missing: string[] = [];
    const recommended: string[] = [];

    if (variants.length === 0) {
      missing.push("variant props");
      recommended.push("Add or document default, hover, focus, disabled, loading, and error variants where relevant.");
    }
    if (!component.description?.trim()) {
      missing.push("component description");
      recommended.push("Add a Figma component description that explains usage, anatomy, and constraints.");
    }
    if (!hasTokens) {
      missing.push("token dependencies");
      recommended.push("Sync Figma Variables or add token references before implementation.");
    }

    return {
      component,
      missing,
      recommended,
      status: missing.length === 0 ? "ready" : missing.length <= 1 ? "needs-review" : "needs-work",
    };
  });
}

function formatComponentDiffReport(components: DesignSystemComponentInfo[], variables: DesignSystemVariableInfo[]): string {
  const items = buildComponentDiffItems(components, variables);
  const realCount = components.filter((component) => component.source !== "suggested").length;
  const suggestedCount = components.filter((component) => component.source === "suggested").length;
  const rows = items.map(
    (item) =>
      `| ${item.component.name} | ${item.component.source ?? "unknown"} | ${item.component.role ?? "unknown"} | ${item.status} | ${item.missing.join(", ") || "none"} | \`${componentCodePath(item.component)}\` |`,
  );

  return `# Component Diff Report

This report compares synced Figma component metadata against the code-ready contract expected by AI agents.

## Summary
- Components checked: ${components.length}
- Real components: ${realCount}
- Suggested placeholders: ${suggestedCount}
- Ready: ${items.filter((item) => item.status === "ready").length}
- Needs review: ${items.filter((item) => item.status === "needs-review").length}
- Needs work: ${items.filter((item) => item.status === "needs-work").length}

## Diff Table
| Component | Source | Role | Status | Missing metadata | Suggested code path |
| --- | --- | --- | --- | --- | --- |
${rows.length > 0 ? rows.join("\n") : "| No components synced | n/a | n/a | n/a | n/a | n/a |"}

## Recommended Fixes
${items
  .filter((item) => item.recommended.length > 0)
  .map((item) => `### ${item.component.name}\n${item.recommended.map((line) => `- ${line}`).join("\n")}`)
  .join("\n\n") || "All synced components have enough metadata for a first implementation pass."}
`;
}

function formatCodeConnectMd(components: DesignSystemComponentInfo[], variables: DesignSystemVariableInfo[]): string {
  const rows = components.slice(0, MAX_EXPORT_COMPONENTS).map((component) =>
    `| ${component.name} | ${component.source ?? "unknown"} | \`${component.nodeId ?? "n/a"}\` | \`${component.componentKey ?? "n/a"}\` | \`${componentCodePath(component)}\` | ${Object.keys(component.variantProperties ?? {}).join(", ") || "none synced"} |`,
  );

  return `# Code Connect Plan

Use this file to map Figma components to code components before asking an AI agent to implement or refactor UI.

## Mapping Table
| Component | Source | Local node ID | Component key | Suggested code path | Variant props |
| --- | --- | --- | --- | --- | --- |
${rows.length > 0 ? rows.join("\n") : "| No synced components | n/a | n/a | n/a | n/a | n/a |"}

## Mapping Rules
- Treat Figma node IDs as the stable source for MCP reads and writes.
- Use local node IDs for local/document components and component keys for library imports.
- Suggested components are placeholders only; do not attempt Code Connect or instancing until they exist in Figma.
- Treat suggested code paths as the default implementation target for Claude, Codex, Cursor, and Windsurf.
- When Code Connect is available, map each Figma node to the matching code component before refactoring.
- If a component has no variants, create code props only when a real state or product requirement needs them.
- Keep token usage aligned with \`design-system/tokens/tokens.css\`.

## Component Details
${components.length > 0 ? components.slice(0, MAX_DETAILED_COMPONENTS).map((component) => formatComponentMcpMetadata(component, variables)).join("\n\n") : "No components synced yet."}
${components.length > MAX_DETAILED_COMPONENTS ? `\n\n${components.length - MAX_DETAILED_COMPONENTS} component mappings omitted from markdown detail. See component-manifest.json.` : ""}
`;
}

function formatCodeConnectCliMd(components: DesignSystemComponentInfo[]): string {
  return `# Code Connect CLI Setup

This file is a practical checklist for turning the generated Code Connect plan into real Figma Code Connect mappings.

## What DesignReady Already Knows
- Figma node IDs for synced components.
- Suggested code paths for component implementation.
- Variant props and states when they are available from Figma.
- Token dependencies from synced Figma Variables.

## Manual Setup Steps
1. Install and configure Figma Code Connect for this repo.
2. For each component in \`design-system/code-connect.md\`, map the Figma node ID to the suggested code path.
3. Keep component prop names aligned with Figma variant property names.
4. Re-run DesignReady after Figma variants or component names change.

## Mapping Candidates
${components.slice(0, MAX_EXPORT_COMPONENTS)
  .map(
    (component) => `- ${component.name}
  - Figma node ID: \`${component.id}\`
  - Code path: \`${componentCodePath(component)}\`
  - Props: ${Object.keys(component.variantProperties ?? {}).join(", ") || "none synced"}`,
  )
  .join("\n") || "- No synced components yet."}

## Agent Instruction
Ask Claude, Codex, Cursor, or Windsurf to use this file plus \`component-manifest.json\` before writing Code Connect templates.`;
}

function formatRepoPatchPlan(components: DesignSystemComponentInfo[], variables: DesignSystemVariableInfo[]): string {
  return `# Repo Patch Plan

Use this as the implementation queue for Claude, Codex, Cursor, or Windsurf.

## Patch Order
1. Read \`component-manifest.json\`.
2. Create or update token files from \`design-system/tokens\`.
3. Implement atoms first, then molecules, then organisms.
4. Add stories and tests for every component touched.
5. Run lint, unit tests, and visual review before committing.

## Component Tasks
${components.slice(0, MAX_DETAILED_COMPONENTS)
  .map(
    (component) => `### ${component.name}
${formatRecommendedCodeEdits(component)}
- Token references available: ${getComponentTokenCandidates(variables, 8).map((variable) => variable.name).join(", ") || "none synced"}`,
  )
  .join("\n\n") || "No synced component tasks yet."}
${components.length > MAX_DETAILED_COMPONENTS ? `\n\n${components.length - MAX_DETAILED_COMPONENTS} component tasks omitted. Use component-manifest.json for the full compact list.` : ""}
`;
}

function formatMcpModeMd(root: string): string {
  return `# MCP Mode

Use this file when an AI agent has access to Figma MCP.

## Read Mode
- Read \`${root}/design-system/component-manifest.json\` first.
- Use each \`figmaNodeId\` to inspect the matching Figma component.
- Compare Figma metadata against \`${root}/design-system/components/all.md\`.
- Edit code only unless the task explicitly asks for Figma changes.

## Write Mode
- Only edit Figma nodes listed in \`component-manifest.json\`.
- Preserve Figma component names, variant names, and token bindings.
- After editing Figma, run DesignReady sync again and update exported docs.
- Never delete or rename a token/component without confirmation.

## Agent Safety
- If MCP write access is unavailable, do not simulate Figma edits. Produce a code patch plan instead.
- If Code Connect exists, prefer mapped code components over generating one-off UI.
- If a node ID cannot be found, use the component name and page name to locate it manually, then update the manifest after sync.`;
}

function formatVisualPreviewTemplates(projectName: string, layoutTemplate: string, preset: OpenDesignPreset): string {
  return `# Visual Preview Templates

Project: ${projectName}
Selected template: ${layoutTemplate}
Open Design preset: ${preset.label}

## Template Options
${LAYOUT_TEMPLATES.map((template) => `- ${template}${template === layoutTemplate ? " (selected)" : ""}`).join("\n")}

## Selected Template Contract
- Start from synced components before creating new layout primitives.
- Use the Open Design preset as a visual lens only.
- Keep generated frames editable and named by section.
- Use real component instances when available; use placeholders only when Figma nodes cannot be instantiated.

## Suggested Frame Sections
${layoutTemplate === "Dashboard" ? "- Header\n- Sidebar or top navigation\n- KPI cards\n- Main chart region\n- Data table\n- Activity feed" : ""}
${layoutTemplate === "Admin table" ? "- Header\n- Filter bar\n- Bulk actions\n- Data table\n- Pagination\n- Empty and error states" : ""}
${layoutTemplate === "Settings" ? "- Settings navigation\n- Profile section\n- Form groups\n- Toggle rows\n- Danger zone\n- Save/cancel actions" : ""}
${layoutTemplate === "Landing page" ? "- Hero\n- Social proof\n- Feature grid\n- Product preview\n- Pricing or CTA\n- Footer" : ""}
${layoutTemplate === "Mobile app" ? "- Mobile shell\n- Top bar\n- Content list\n- Primary action\n- Bottom navigation\n- Empty/loading/error states" : ""}
${layoutTemplate === "AI workspace" ? "- Conversation/sidebar layout\n- Prompt composer\n- Model/status controls\n- Response area\n- Source/citation panel\n- Action toolbar" : ""}
${layoutTemplate === "Developer console" ? "- App shell\n- Resource list\n- Detail pane\n- Logs or code panel\n- Status checks\n- Command palette" : ""}
`;
}

function formatAgentRuleFile(agentName: string, root: string, sharedModelRules: string): string {
  return `# ${agentName} Design System Rules

Read these files before editing UI:
- ${root}/design.md
- ${root}/design-system/components/all.md
- ${root}/design-system/code-connect.md
- ${root}/design-system/component-manifest.json
- ${root}/design-system/tokens/tokens.css

When implementing:
- Prefer documented components and suggested code paths.
- Use component-manifest.json for machine-readable Figma node IDs, code paths, variants, states, and token dependencies.
- Use code-connect.md to map Figma components to code components.
- If Figma MCP write access exists, update the referenced node only when the task asks for Figma changes.
- If Figma MCP write access is missing, treat Figma metadata as design truth and edit code only.

${sharedModelRules}
`;
}

function formatFigmaMakeMd(args: {
  projectName: string;
  industry: string;
  style: string;
  preset: OpenDesignPreset;
  snapshot: DesignSystemSnapshot | null;
  uiAudit: UiCriterionScore[];
  variables: DesignSystemVariableInfo[];
  components: DesignSystemComponentInfo[];
}): string {
  const grouped = groupComponents(args.components);

  return `# Figma Make Context - ${args.projectName}

**Last Synced:** ${formatSyncDate()}  
**Project:** ${args.projectName}  
**Industry:** ${args.industry}  
**Design Style:** ${args.style}
**Open Design Preset:** ${args.preset.label}

---

## 1. Project Identity & Core Principles

- **Atomic Design Methodology**: strictly follow Atoms -> Molecules -> Organisms -> Templates -> Screens.
- **Token-First Approach**: always use design tokens from \`tokens/tokens.json\` and \`tokens/tokens.css\`. Never hardcode colors, spacing, radius, typography, shadows, or motion values.
- **Source of Truth**: Figma Variables and Modes for Light/Dark take priority.
- **Naming Convention**: use Figma's exact names. Use kebab-case for folders/files and PascalCase for React components.
- **Layout**: use Auto Layout semantics exclusively where possible. Horizontal means row; vertical means column. Avoid absolute positioning unless the source layer requires it.
- **Dark Mode**: support Light/Dark through Figma Modes and semantic tokens.
- **Owner**: ${DEFAULT_OWNER_NAME}
- **Contact**: ${DEFAULT_OWNER_CONTACT}
- **Source file**: ${args.snapshot?.fileName ?? "Unknown"}
- **Source page**: ${args.snapshot?.pageName ?? "Unknown"}

## Open Design Direction
${formatOpenDesignPreset(args.preset)}

## Required Sources
| Source | Use for |
| --- | --- |
| \`../design.md\` | UI scoring, layout principles, responsive rules, accessibility, and polish requirements |
| \`../tokens/tokens.json\` | Machine-readable token values |
| \`../tokens/tokens.css\` | CSS custom property names and implementation mapping |
| \`../tokens/variables.md\` | Human-readable Figma variable reference |
| \`../components/atoms.md\` | Primitive controls and small reusable UI elements |
| \`../components/molecules.md\` | Form groups, rows, cards, dialogs, and composed controls |
| \`../components/organisms.md\` | Navigation, tables, dashboards, page regions, and screen-level patterns |

## 2. Generation Rules (Apply to All Components)

- Generate from synced Figma components and variants.
- Keep frames editable, well-named, and logically grouped.
- Include every available state: \`default\`, \`hover\`, \`focus\`, \`pressed\`, \`selected\`, \`disabled\`, \`loading\`, \`error\`, and \`empty\`.
- Visible focus states are required.
- Minimum touch target is 44px where touch is expected.
- Icon-only elements require proper \`aria-label\`.
- Do not rely on color alone for meaning.
- Keep animation conservative and subtle. Use motion tokens first; use short CSS transitions only when motion tokens are unavailable.
- Use tokens plus CSS Modules or the project styling convention. Avoid inline styles for design values.

## 3. Token Usage Rules (Critical - Anti Token Explosion)

### Priority Order
1. Semantic tokens, for example \`color.background.default\`, \`color.text.primary\`, and \`space.md\`.
2. Primitive tokens only when a semantic token does not exist.
3. Component tokens only when truly necessary, usually when more than three components share the same special value.

### Rules
- Maximize alias usage.
- Never duplicate token values.
- Always check \`tokens.json\` before creating new tokens.
- Keep component-specific tokens minimal.
- Never introduce random hex, px, radius, shadow, z-index, typography, or motion values.

${formatMakeGlobalComponentRules(args.components)}

## 5. UI Quality Gate (Target)

${formatUiAudit(args.uiAudit)}

### Minimum Target Scores
- Color consistency: >= 9/10
- Typography hierarchy: >= 9/10
- Spacing rhythm: >= 9/10
- Component consistency: 10/10
- Accessibility: >= 9/10
- Information density: 10/10 for enterprise systems
- Dark mode support: >= 9/10

## 6. Strict Instructions for AI (Must Read Before Generating)

Follow this order every time:
1. Read Project Identity & Core Principles.
2. Read Generation Rules.
3. Read Token Usage Rules.
4. Read relevant Global Component Rules.
5. Check and use only existing tokens from the tokens folder.
6. Follow Atomic Design composition rules.
7. Generate all defined variants and states.
8. Ensure full accessibility and dark mode compatibility.

### Prohibited
- Hardcoding any design values.
- Duplicating components or logic.
- Skipping states or accessibility features.
- Using inline styles instead of tokens plus CSS Modules or the project styling convention.

${formatLayoutStructureGuidelines(args.components)}

${formatLayoutPrinciples(args.variables)}

${formatTypographyGuidelines(args.variables)}

${formatDepthElevationGuidelines(args.variables)}

${formatVisualThemeAtmosphere()}

${formatResponsiveGuidelines(args.components)}

${formatCollapsingStrategy()}

${formatAccessibilityGuidelines()}

${formatTouchTargets()}

${formatImageBehavior()}

${formatDosAndDonts()}

## Component Source

### Atoms
${formatDetailedComponents(grouped.atoms, args.variables)}

### Molecules
${formatDetailedComponents(grouped.molecules, args.variables)}

### Organisms
${formatDetailedComponents(grouped.organisms, args.variables)}

## Variables Source
${formatVariables(args.variables)}

## Delivery Checklist
- Generated screens are editable and layer names are meaningful.
- Every visible color, radius, spacing, shadow, and type choice maps to a token or is documented as intentional.
- Navigation, forms, tables, cards, modals, empty states, loading states, and error states are covered when relevant.
- Mobile, tablet, and desktop layouts avoid text overlap, clipped controls, and hidden primary actions.
- Every UI scoring criterion is 7/10 or higher before delivery.
`;
}

function formatAgentKnowledgeReadme(args: {
  projectName: string;
  root: string;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  uiAudit: UiCriterionScore[];
}): string {
  return `# Agent Knowledge Pack

This folder gives AI agents a compact operating model for this design system. It is inspired by agent patterns such as skills, memory, context compression, specialized agents, and scheduled audits.

## Start Here
| Order | File | Purpose |
| ---: | --- | --- |
| 1 | \`context-summary.md\` | Short context for low-token model calls |
| 2 | \`memory.md\` | Durable project decisions and export history |
| 3 | \`skills/design-system/SKILL.md\` | How to implement with this design system |
| 4 | \`skills/figma-mcp/SKILL.md\` | How to inspect or edit Figma with MCP |
| 5 | \`skills/frame-export/SKILL.md\` | How to reason about generated Figma frames |
| 6 | \`agents/ui-reviewer.md\` | UI audit role |
| 7 | \`agents/token-mapper.md\` | Token mapping role |
| 8 | \`agents/component-mapper.md\` | Component mapping role |

## Project Snapshot
| Field | Value |
| --- | --- |
| Project | ${args.projectName} |
| Export root | \`${args.root}\` |
| Components | ${args.components.length} |
| Variables | ${args.variables.length} |
| Average UI score | ${Math.round((args.uiAudit.reduce((sum, item) => sum + item.score, 0) / args.uiAudit.length) * 10) / 10}/10 |

## Operating Rules
- Use \`../design.md\` as the human rulebook.
- Use \`../design-system/component-manifest.json\` as the full machine-readable component source.
- Use \`../design-system/tokens/tokens.json\` and \`../design-system/tokens/tokens.css\` before raw values.
- Keep summaries short. Keep full data in manifest and token files.
- When changing code or Figma, update memory with the decision and reason.
`;
}

function formatAgentContextSummary(args: {
  projectName: string;
  industry: string;
  style: string;
  preset: OpenDesignPreset;
  layoutTemplate: string;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  uiAudit: UiCriterionScore[];
}): string {
  const grouped = groupComponents(args.components);
  const weakItems = args.uiAudit.filter((item) => item.score < 7).map((item) => item.label);
  const keyComponents = args.components
    .filter((component) => component.source !== "suggested")
    .slice(0, 20)
    .map((component) => `- ${component.name} (${component.type}, ${component.role ?? "unknown"}, ${component.source ?? "unknown"})`)
    .join("\n");

  return `# Context Summary

## Project
| Field | Value |
| --- | --- |
| Name | ${args.projectName} |
| Industry | ${args.industry} |
| Style | ${args.style} |
| Open Design preset | ${args.preset.label} |
| Preferred frame template | ${args.layoutTemplate} |

## Counts
| Type | Count |
| --- | ---: |
| Atoms | ${grouped.atoms.length} |
| Molecules | ${grouped.molecules.length} |
| Organisms | ${grouped.organisms.length} |
| Tokens | ${args.variables.length} |

## Current Risks
${weakItems.length > 0 ? weakItems.map((item) => `- Improve ${item}.`).join("\n") : "- No UI audit category is below 7/10 in the current scan."}

## Key Components
${keyComponents || "- No real Figma components synced yet. Use starter suggestions only as placeholders."}

## Short Instruction
Implement with existing components and tokens first. If a component or token is missing, document the gap in \`memory.md\` before creating a replacement.
`;
}

function formatAgentMemory(args: {
  projectName: string;
  preset: OpenDesignPreset;
  layoutTemplate: string;
  snapshot: DesignSystemSnapshot | null;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
}): string {
  const sourceCounts = args.components.reduce<Record<string, number>>((counts, component) => {
    const source = component.source ?? "unknown";
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});

  return `# Project Memory

This file is the durable memory for future AI sessions. Append new decisions instead of replacing old ones.

## Current Export
| Field | Value |
| --- | --- |
| Project | ${args.projectName} |
| Exported at | ${formatSyncDate()} |
| Figma file | ${args.snapshot?.fileName ?? "Unknown"} |
| Figma scope | ${args.snapshot?.pageName ?? "Unknown"} |
| Open Design preset | ${args.preset.label} |
| Frame template | ${args.layoutTemplate} |
| Components | ${args.components.length} |
| Variables | ${args.variables.length} |

## Component Source Counts
| Source | Count |
| --- | ---: |
| local | ${sourceCounts.local ?? 0} |
| document | ${sourceCounts.document ?? 0} |
| instance | ${sourceCounts.instance ?? 0} |
| library | ${sourceCounts.library ?? 0} |
| suggested | ${sourceCounts.suggested ?? 0} |
| unknown | ${sourceCounts.unknown ?? 0} |

## Decisions
| Date | Decision | Reason | Files |
| --- | --- | --- | --- |
| ${formatSyncDate()} | Use exported manifest and tokens as source of truth. | Prevent agents from inventing components or design values. | \`design-system/component-manifest.json\`, \`design-system/tokens/tokens.json\` |
| ${formatSyncDate()} | Treat suggested components as placeholders. | They are not editable Figma components until created or mapped. | \`design-system/component-manifest.json\` |

## Open Questions
| Question | Owner | Status |
| --- | --- | --- |
| Which exact components should map to each frame template section? | Design/Product | Needs review |
| Which tokens are semantic versus primitive? | Design System | Needs review |
`;
}

function formatDesignSystemSkill(root: string): string {
  return `# Design System Implementation Skill

Use this skill when implementing or modifying UI from this exported design system.

## Required Reading
- \`../../context-summary.md\`
- \`../../../design.md\`
- \`../../../design-system/component-manifest.json\`
- \`../../../design-system/tokens/tokens.json\`
- \`../../../design-system/tokens/tokens.css\`

## Workflow
1. Identify the screen or component being changed.
2. Find matching components in \`component-manifest.json\`.
3. Read token names from \`tokens.json\` and CSS variable names from \`tokens.css\`.
4. Implement using existing components before creating new ones.
5. Verify responsive behavior at 375, 768, 1024, 1280, and 1440px.
6. Update \`agent-knowledge/memory.md\` with any design decision.

## Rules
- Do not hardcode design values when a token exists.
- Do not replace real Figma components with suggested placeholders.
- Do not flatten accessibility states.
- Keep generated code aligned with \`${root}/design-system/file-structure.md\`.
`;
}

function formatFigmaMcpSkill(): string {
  return `# Figma MCP Skill

Use this skill when an agent has Figma MCP access and needs to inspect or edit the design.

## Read Mode
- Use node IDs from \`../../../design-system/component-manifest.json\`.
- Inspect existing local/document components before creating anything.
- Library components should be imported by component key when write access allows it.

## Write Mode
- Only edit nodes explicitly requested by the user.
- Preserve component names, variant properties, and token bindings.
- After editing Figma, refresh the DesignReady export so manifests and memory stay current.

## Frame Export Rules
- Prefer real local/document/library components.
- Suggested components are placeholders only.
- If a template section receives the wrong component, record the desired mapping in \`../../memory.md\`.
`;
}

function formatFrameExportSkill(): string {
  return `# Frame Export Skill

Use this skill when reviewing or improving generated Figma frames.

## Checks
| Area | Pass condition |
| --- | --- |
| Template | Sections match the selected layout type |
| Components | Real components are instantiated before suggested placeholders |
| Mapping | Header, table, form, KPI, chart, modal, and action areas use matching roles |
| Tokens | Labels and generated surfaces use synced variables when possible |
| Editability | Output remains editable Figma frames and instances |

## Failure Handling
- If only one frame is generated, verify whether the selected mode is project layout export rather than multi-screen export.
- If component instances do not appear, check whether local node IDs or library component keys are available.
- If component choice is wrong, update the memory mapping request before regenerating.
`;
}

function formatAgentRoleFile(role: "ui-reviewer" | "token-mapper" | "component-mapper"): string {
  const roleMap = {
    "ui-reviewer": {
      title: "UI Reviewer Agent",
      goal: "Find visual, responsive, and accessibility problems before implementation is accepted.",
      inputs: ["design.md", "design-system/figma/snapshot.md", "design-system/component-diff.md"],
      checks: ["Contrast and focus visibility", "Spacing rhythm and information density", "Mobile/tablet/desktop text fit", "Loading, empty, error, and disabled states"],
      output: "A severity-ordered review with file or component references.",
    },
    "token-mapper": {
      title: "Token Mapper Agent",
      goal: "Map design values to existing tokens and prevent token explosion.",
      inputs: ["design-system/tokens/tokens.json", "design-system/tokens/tokens.css", "design-system/component-manifest.json"],
      checks: ["Semantic token availability", "Duplicate token values", "Raw color/spacing/radius usage", "Alias candidates"],
      output: "A token mapping table and missing-token list.",
    },
    "component-mapper": {
      title: "Component Mapper Agent",
      goal: "Map Figma components to code components and frame template sections.",
      inputs: ["design-system/component-manifest.json", "design-system/code-connect.md", "design-system/figma/visual-preview-templates.md"],
      checks: ["Real versus suggested components", "Local node ID versus library key", "Variant coverage", "Template section role match"],
      output: "A component mapping table with confidence and gaps.",
    },
  } as const;
  const item = roleMap[role];
  return `# ${item.title}

## Goal
${item.goal}

## Inputs
${item.inputs.map((input) => `- \`${input}\``).join("\n")}

## Checks
${item.checks.map((check) => `- ${check}`).join("\n")}

## Output
${item.output}
`;
}

function formatWorkflowMd(args: {
  step: "design-intake" | "template-mapping" | "frame-export" | "live-preview" | "visual-diff" | "code-review";
  root: string;
  projectName: string;
  layoutTemplate: string;
}): string {
  const workflows = {
    "design-intake": {
      title: "01 Design Intake",
      goal: "Understand the exported design system before planning implementation.",
      steps: [
        "Read design.md and agent-knowledge/context-summary.md.",
        "Check component and token counts against component-manifest.json and tokens.json.",
        "Identify missing components, suggested placeholders, and weak UI audit scores.",
        "Write assumptions to agent-knowledge/memory.md before implementation.",
      ],
      evidence: ["Project summary is understood", "Open questions are listed", "No implementation starts before source files are read"],
    },
    "template-mapping": {
      title: "02 Template Mapping",
      goal: "Map each template section to the best available real Figma component.",
      steps: [
        "Read design-system/component-manifest.json.",
        "Prefer real local/document/library components over suggested placeholders.",
        "Map navigation/header, KPI/chart, table/list, form/action, and state sections separately.",
        "Record unresolved sections in agent-knowledge/memory.md.",
      ],
      evidence: ["Every section has a selected component or documented fallback", "No suggested component is used when a real match exists"],
    },
    "frame-export": {
      title: "03 Frame Export",
      goal: "Generate an editable Figma frame whose preview contains mapped component instances.",
      steps: [
        "Use the Template Mapping panel before exporting.",
        "Export the Figma frame.",
        "Confirm the Template Preview contains real component instances, not wireframe-only boxes.",
        "Record instance count, placeholder count, and section mapping evidence.",
      ],
      evidence: ["Frame node exists", "Template Preview contains mapped instances", "Placeholder usage is explained"],
    },
    "live-preview": {
      title: "04 Live Preview",
      goal: "Generate a runnable app preview from the exported design system.",
      steps: [
        "Read app-generation/live-preview.md.",
        "Create or update a DesignSystemPreview route/story.",
        "Import tokens.css and implement with manifest components.",
        "Run the preview locally and capture screenshots.",
      ],
      evidence: ["Preview route opens", "Screenshots exist", "Tokens are used before raw values"],
    },
    "visual-diff": {
      title: "05 Visual Diff",
      goal: "Compare generated UI against Figma/exported preview with objective evidence.",
      steps: [
        "Read quality/visual-diff.md.",
        "Capture baseline and candidate screenshots.",
        "Run screenshot comparison at desktop and mobile sizes.",
        "Report layout, component, token, typography, responsive, and accessibility differences.",
      ],
      evidence: ["Screenshot diff result exists", "Failures are linked to sections/components", "Threshold is stated"],
    },
    "code-review": {
      title: "06 Code Review",
      goal: "Review implementation against design compliance and engineering quality before saying done.",
      steps: [
        "Run tests, lint, build, and visual diff.",
        "Review token usage, component reuse, responsive behavior, and accessibility.",
        "Check changed files only, then summarize residual risks.",
        "Append final decisions to agent-knowledge/memory.md.",
      ],
      evidence: ["Verification commands pass or failures are documented", "Findings are severity ordered", "Memory is updated"],
    },
  } as const;
  const workflow = workflows[args.step];

  return `# ${workflow.title}

Project: ${args.projectName}  
Template: ${args.layoutTemplate}

## Goal
${workflow.goal}

## Required Inputs
| File | Use |
| --- | --- |
| \`${args.root}/design.md\` | Compact design rulebook |
| \`${args.root}/design-system/component-manifest.json\` | Full component source |
| \`${args.root}/design-system/tokens/tokens.json\` | Full token source |
| \`${args.root}/agent-knowledge/context-summary.md\` | Low-token context |
| \`${args.root}/agent-knowledge/memory.md\` | Durable decisions |

## Steps
${workflow.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Evidence Required
${workflow.evidence.map((item) => `- ${item}`).join("\n")}

## Stop Conditions
- Source files are missing or contradictory.
- Real components exist but mapping still uses suggested placeholders.
- Verification cannot run and the reason is not documented.
`;
}

function formatImplementationPlanMd(args: {
  root: string;
  projectName: string;
  layoutTemplate: string;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  uiAudit: UiCriterionScore[];
}): string {
  const weakItems = args.uiAudit.filter((item) => item.score < 8);
  return `# Implementation Plan

This plan is intentionally small and verifiable. Complete one task at a time.

## Project
| Field | Value |
| --- | --- |
| Name | ${args.projectName} |
| Template | ${args.layoutTemplate} |
| Components | ${args.components.length} |
| Tokens | ${args.variables.length} |

## Tasks
| Step | Task | Files | Verify |
| ---: | --- | --- | --- |
| 1 | Read design context and memory | \`${args.root}/design.md\`, \`${args.root}/agent-knowledge/memory.md\` | Assumptions are listed |
| 2 | Map template sections to components | \`${args.root}/design-system/component-manifest.json\` | No section uses suggested component when real component exists |
| 3 | Export Figma frame | Figma project frame | Template Preview contains component instances |
| 4 | Build live preview | \`${args.root}/app-generation/live-preview.md\` | Preview route/story renders |
| 5 | Run visual diff | \`${args.root}/quality/visual-diff.md\` | Diff result is below threshold or findings are filed |
| 6 | Review and finish | \`${args.root}/quality/verification-checklist.md\` | Tests, lint, build, and review status are documented |

## Current Risks
${weakItems.length > 0 ? weakItems.map((item) => `- ${item.label}: ${item.score}/10 - ${item.rationale}`).join("\n") : "- No UI audit item is below 8/10."}

## Finish Rule
Do not report the work as complete until evidence is attached or the missing evidence is explicitly listed.
`;
}

function formatVerificationChecklistMd(args: {
  root: string;
  layoutTemplate: string;
}): string {
  return `# Verification Checklist

Use this before reporting that generation or implementation is complete.

## Required Checks
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| Source files read | Pending | \`${args.root}/design.md\`, \`${args.root}/component-manifest.json\` |
| Template mapping reviewed | Pending | ${args.layoutTemplate} section mapping |
| Figma frame exported | Pending | Frame node ID |
| Preview contains component instances | Pending | Instance count per section |
| Placeholder usage justified | Pending | Placeholder count and reason |
| Live preview runs | Pending | URL or Storybook story |
| Visual diff run | Pending | Screenshot diff result |
| Responsive checked | Pending | 375, 768, 1024, 1280, 1440px |
| Accessibility checked | Pending | Focus, labels, contrast, target size |
| Tests pass | Pending | Command output |
| Lint pass | Pending | Command output |
| Build pass | Pending | Command output |

## Evidence Rule
Claims without evidence should be treated as incomplete. If a check cannot run, write the blocker and next action.
`;
}

function formatExportEvidenceSchema(args: {
  projectName: string;
  layoutTemplate: string;
}) {
  return `${JSON.stringify({
    schemaVersion: 1,
    projectName: args.projectName,
    layoutTemplate: args.layoutTemplate,
    generatedAt: formatSyncDate(),
    frame: {
      nodeId: null,
      name: null,
      width: null,
      height: null,
    },
    preview: {
      containsWireframeOnly: false,
      instanceCount: 0,
      placeholderCount: 0,
      sections: [
        {
          title: "Navigation and header",
          mappedComponentKeys: [],
          instanceNames: [],
          placeholderNames: [],
          evidence: "Fill after export or MCP inspection.",
        },
      ],
    },
    verification: {
      figmaMcpInspected: false,
      visualDiffRun: false,
      livePreviewRun: false,
      testsPassed: null,
      lintPassed: null,
      buildPassed: null,
    },
  }, null, 2)}\n`;
}

function formatDesignReadyAuditScript(root: string): string {
  return `import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const candidates = [cwd, path.join(cwd, "${root}")];
const exportRoot = candidates.find((candidate) =>
  fs.existsSync(path.join(candidate, "design-system", "component-manifest.json"))
) ?? candidates[0];
const manifestPath = path.join(exportRoot, "design-system", "component-manifest.json");
const tokensPath = path.join(exportRoot, "design-system", "tokens", "tokens.json");
const evidencePath = path.join(exportRoot, "quality", "export-evidence.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message) {
  console.error("[designready-audit] " + message);
  process.exitCode = 1;
}

if (!fs.existsSync(manifestPath)) {
  fail("Missing component manifest: " + manifestPath);
}

if (!fs.existsSync(tokensPath)) {
  fail("Missing tokens source: " + tokensPath);
}

const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : { components: [] };
const tokens = fs.existsSync(tokensPath) ? readJson(tokensPath) : {};
const components = Array.isArray(manifest.components) ? manifest.components : [];
const suggested = components.filter((component) => component.source === "suggested");
const real = components.filter((component) => component.source !== "suggested");
const withVariants = components.filter((component) => component.variants && Object.keys(component.variants).length > 0);

if (components.length === 0) {
  fail("No components found in component-manifest.json");
}

if (Object.keys(tokens).length === 0) {
  fail("No tokens found in tokens.json");
}

if (real.length === 0 && suggested.length > 0) {
  fail("Only suggested components are available. Sync or map real Figma components before implementation.");
}

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  componentCounts: {
    total: components.length,
    real: real.length,
    suggested: suggested.length,
    withVariants: withVariants.length,
  },
  tokenCount: Object.keys(tokens).length,
  checks: {
    hasComponents: components.length > 0,
    hasTokens: Object.keys(tokens).length > 0,
    hasRealComponents: real.length > 0,
    hasVariantCoverage: withVariants.length > 0,
  },
  warnings: [
    ...(suggested.length > 0 ? [suggested.length + " suggested components still need real Figma mapping."] : []),
    ...(withVariants.length === 0 ? ["No variant metadata found. Add Figma variant properties for stronger generation."] : []),
  ],
};

fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\\n");
console.log("[designready-audit] wrote " + evidencePath);
`;
}

function formatDesignReadyWorkflow(): string {
  return `name: DesignReady Audit

on:
  pull_request:
  workflow_dispatch:
  schedule:
    - cron: "0 3 * * *"

jobs:
  designready-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: |
          if [ -f package-lock.json ]; then
            npm ci
          else
            npm install
          fi
      - run: npm run test --if-present
      - run: npm run lint --if-present
      - run: npm run build --if-present
      - run: node scripts/designready-audit.mjs
      - run: npx playwright test -c playwright.designready.config.ts
        env:
          DESIGNREADY_PREVIEW_URL: http://localhost:5173/design-preview
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: designready-evidence
          path: |
            **/quality/export-evidence.json
            test-results/**
            playwright-report/**
`;
}

function formatPlaywrightDesignReadyConfig(): string {
  return `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/designready",
  reporter: [["html", { outputFolder: "playwright-report/designready" }], ["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
  ],
});
`;
}

function formatDesignReadyVisualSpec(): string {
  return `import { test, expect } from "@playwright/test";

const previewUrl = process.env.DESIGNREADY_PREVIEW_URL ?? "http://localhost:5173/design-preview";

test("designready preview has no blank render and stays visually stable", async ({ page }) => {
  await page.goto(previewUrl, { waitUntil: "networkidle" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page).toHaveScreenshot("designready-preview.png", {
    maxDiffPixelRatio: 0.02,
    fullPage: true,
  });
});
`;
}

function buildAgentKnowledgeFiles(args: {
  root: string;
  projectName: string;
  industry: string;
  style: string;
  preset: OpenDesignPreset;
  layoutTemplate: string;
  snapshot: DesignSystemSnapshot | null;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  uiAudit: UiCriterionScore[];
}): ProjectFile[] {
  const base = `${args.root}/agent-knowledge`;
  return [
    {
      path: `${base}/README.md`,
      content: formatAgentKnowledgeReadme(args),
    },
    {
      path: `${base}/context-summary.md`,
      content: formatAgentContextSummary(args),
    },
    {
      path: `${base}/memory.md`,
      content: formatAgentMemory(args),
    },
    {
      path: `${base}/skills/design-system/SKILL.md`,
      content: formatDesignSystemSkill(args.root),
    },
    {
      path: `${base}/skills/figma-mcp/SKILL.md`,
      content: formatFigmaMcpSkill(),
    },
    {
      path: `${base}/skills/frame-export/SKILL.md`,
      content: formatFrameExportSkill(),
    },
    {
      path: `${base}/agents/ui-reviewer.md`,
      content: formatAgentRoleFile("ui-reviewer"),
    },
    {
      path: `${base}/agents/token-mapper.md`,
      content: formatAgentRoleFile("token-mapper"),
    },
    {
      path: `${base}/agents/component-mapper.md`,
      content: formatAgentRoleFile("component-mapper"),
    },
    {
      path: `${base}/workflows/01-design-intake.md`,
      content: formatWorkflowMd({ step: "design-intake", root: args.root, projectName: args.projectName, layoutTemplate: args.layoutTemplate }),
    },
    {
      path: `${base}/workflows/02-template-mapping.md`,
      content: formatWorkflowMd({ step: "template-mapping", root: args.root, projectName: args.projectName, layoutTemplate: args.layoutTemplate }),
    },
    {
      path: `${base}/workflows/03-frame-export.md`,
      content: formatWorkflowMd({ step: "frame-export", root: args.root, projectName: args.projectName, layoutTemplate: args.layoutTemplate }),
    },
    {
      path: `${base}/workflows/04-live-preview.md`,
      content: formatWorkflowMd({ step: "live-preview", root: args.root, projectName: args.projectName, layoutTemplate: args.layoutTemplate }),
    },
    {
      path: `${base}/workflows/05-visual-diff.md`,
      content: formatWorkflowMd({ step: "visual-diff", root: args.root, projectName: args.projectName, layoutTemplate: args.layoutTemplate }),
    },
    {
      path: `${base}/workflows/06-code-review.md`,
      content: formatWorkflowMd({ step: "code-review", root: args.root, projectName: args.projectName, layoutTemplate: args.layoutTemplate }),
    },
    {
      path: `${base}/plans/implementation-plan.md`,
      content: formatImplementationPlanMd(args),
    },
  ];
}

function formatLivePreviewFlowMd(args: {
  projectName: string;
  root: string;
  layoutTemplate: string;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
}): string {
  return `# Live Preview and App Generation Flow

Use this file when generating a runnable app preview from the exported design system.

## Goal
Create a small, inspectable preview app that proves the Figma design system can become production UI.

## Inputs
| File | Use for |
| --- | --- |
| \`${args.root}/design.md\` | Rules, quality gate, and design direction |
| \`${args.root}/design-system/component-manifest.json\` | Full component source |
| \`${args.root}/design-system/tokens/tokens.json\` | Machine-readable values |
| \`${args.root}/design-system/tokens/tokens.css\` | CSS custom properties |
| \`${args.root}/agent-knowledge/context-summary.md\` | Low-token task context |

## Preview Scope
| Item | Value |
| --- | --- |
| Project | ${args.projectName} |
| Template | ${args.layoutTemplate} |
| Components available | ${args.components.length} |
| Tokens available | ${args.variables.length} |

## Implementation Steps
1. Create a preview route or Storybook story named \`DesignSystemPreview\`.
2. Import \`tokens.css\` globally.
3. Implement the selected template using real components from \`component-manifest.json\`.
4. Add fallback placeholder components only when the manifest has no matching real component.
5. Verify at 375, 768, 1024, 1280, and 1440px.
6. Capture screenshots for visual diff.

## Acceptance Criteria
- Preview runs locally with one command.
- No raw color, spacing, radius, or typography values when tokens exist.
- Component names in code map back to manifest entries.
- Empty, loading, error, disabled, hover, focus, and selected states are visible where relevant.
`;
}

function formatRuntimeAutomationMd(args: {
  projectName: string;
  root: string;
  uiAudit: UiCriterionScore[];
}): string {
  const weakItems = args.uiAudit.filter((item) => item.score < 7);
  return `# Runtime Agent Automation

This project export includes static agent knowledge. Runtime automation should be implemented in the consuming repo because Figma plugins cannot run background cron jobs after the plugin is closed.

## Agent Loop
| Step | Action | Output |
| ---: | --- | --- |
| 1 | Read \`${args.root}/agent-knowledge/context-summary.md\` | Short task context |
| 2 | Read changed files and current Figma snapshot | Change scope |
| 3 | Run UI reviewer, token mapper, and component mapper roles | Findings |
| 4 | Apply code or Figma changes | Patch |
| 5 | Run tests, lint, build, and visual diff | Verification |
| 6 | Append result to \`${args.root}/agent-knowledge/memory.md\` | Durable memory |

## Suggested Schedule
| Cadence | Job |
| --- | --- |
| Every PR | UI quality audit, token audit, component mapping audit |
| Daily | Rebuild preview and run visual diff |
| Weekly | Review memory decisions and stale component mappings |
| After Figma sync | Regenerate export and compare manifest/component counts |

## Current Watch Items
${weakItems.length > 0 ? weakItems.map((item) => `- ${item.label}: ${item.score}/10 - ${item.rationale}`).join("\n") : "- No audit item is currently below 7/10."}

## Minimal CI Command Contract
\`\`\`text
npm test
npm run lint
npm run build
npm run visual:diff
\`\`\`

## Memory Rule
Each automation run should append:
- date and branch
- files changed
- design decisions made
- failed checks and fixes
- Figma component mappings added or changed
`;
}

function formatVisualDiffMd(args: {
  root: string;
  layoutTemplate: string;
}): string {
  return `# Visual Diff and Figma Test Plan

Use this when comparing generated app UI or exported Figma frames against expected design output.

## Required Artifacts
| Artifact | Source |
| --- | --- |
| Baseline Figma frame screenshot | Exported frame from DesignReady |
| Candidate app screenshot | Local preview route or Storybook |
| Component manifest | \`${args.root}/design-system/component-manifest.json\` |
| Visual template | \`${args.root}/design-system/figma/visual-preview-templates.md\` |

## Template Under Test
${args.layoutTemplate}

## Diff Checklist
| Area | Fail if |
| --- | --- |
| Layout | Section order, density, or hierarchy differs from template intent |
| Components | Suggested placeholder used where real component exists |
| Tokens | Raw values appear where exported tokens exist |
| Typography | Text size, weight, line height, or truncation breaks hierarchy |
| Responsive | Text overlaps, controls clip, primary action disappears |
| Accessibility | Focus, contrast, labels, or target sizes fail |

## Suggested Playwright Flow
\`\`\`ts
import { test, expect } from "@playwright/test";

test("design preview matches baseline", async ({ page }) => {
  await page.goto("http://localhost:5173/design-preview");
  await expect(page).toHaveScreenshot("design-preview.png", {
    maxDiffPixelRatio: 0.02,
  });
});
\`\`\`

## Figma MCP Check
When MCP is available, inspect the exported frame node and confirm:
- frame name includes the selected template
- component instances are present
- placeholders are only used for unmapped sections
- section names match the template mapping table
`;
}

function buildProjectFiles(args: {
  projectName: string;
  industry: string;
  style: string;
  preset: OpenDesignPreset;
  layoutTemplate: string;
  models: string[];
  snapshot: DesignSystemSnapshot | null;
  useStarter: boolean;
  scanResult: ScanResult | null;
}): ProjectFile[] {
  const root = slugify(args.projectName);
  const sourceComponents = withStarterMolecules(args.snapshot?.components ?? [], args.useStarter);
  const sourceVariables = args.useStarter && (args.snapshot?.variables.length ?? 0) === 0 ? STARTER_VARIABLES : args.snapshot?.variables ?? [];
  const components = sourceComponents;
  const variables = sourceVariables;
  const grouped = groupComponents(components);
  const uiAudit = buildUiAudit(args.scanResult, variables, components);
  const readinessScores = buildReadinessScores(variables, components, uiAudit);
  const aiPrompt = buildAiPrompt(args.projectName, args.industry, args.style, args.preset, args.models, root);
  const sharedModelRules = formatSharedModelRules({ uiAudit, components });
  const componentManifest = buildComponentManifest({
    projectName: args.projectName,
    industry: args.industry,
    style: args.style,
    preset: args.preset,
    models: args.models,
    components,
    variables,
    uiAudit,
    readinessScores,
  });
  const starterBlock = args.useStarter
    ? `\n## Starter proposal\nUse a MISSA-style enterprise system foundation: clear primitives, semantic tokens, form-heavy controls, table patterns, dashboard cards, validation states, and accessibility-first variants.\n\nSuggested components: ${STARTER_COMPONENTS.join(", ")}.\nSuggested molecules: ${STARTER_MOLECULES.map((component) => component.name).join(", ")}.\n`
    : "";
  const agentKnowledgeFiles = buildAgentKnowledgeFiles({
    root,
    projectName: args.projectName,
    industry: args.industry,
    style: args.style,
    preset: args.preset,
    layoutTemplate: args.layoutTemplate,
    snapshot: args.snapshot,
    components,
    variables,
    uiAudit,
  });

  return [
    {
      path: `${root}/CLAUDE.md`,
      content: `# ${args.projectName} Claude Code Guide\n\n${aiPrompt}\n\n## Required reading\n- design.md\n- design-system/file-structure.md\n- design-system/tokens/tokens.json\n- design-system/tokens/tokens.css\n- design-system/components/all.md\n- design-system/figma/make.md when Figma Make output is involved\n\n## Figma sync rules\n- Treat the exported Figma snapshot as current design truth.\n- Update references after each new DesignReady export.\n- Never remove components or tokens without confirmation.\n- For Figma Make output, read design-system/figma/make.md and preserve editable component hierarchy.\n${starterBlock}\n${sharedModelRules}`,
    },
    {
      path: `${root}/AGENTS.md`,
      content: `# ${args.projectName} Codex Guide\n\n${aiPrompt}\n\n## Implementation rules\n- Prefer existing design-system components before creating new UI.\n- Map colors to CSS custom properties from design-system/tokens/tokens.css.\n- Keep component docs and code examples aligned with Figma variants.\n- Follow design-system/file-structure.md for component folders and exports.\n- If target is Figma Make, use design-system/figma/make.md as the detailed generation contract.\n\n${sharedModelRules}\n`,
    },
    ...(hasTargetModel(args.models, "Cursor")
      ? [
          {
            path: `${root}/.cursor/rules/design-system.mdc`,
            content: formatAgentRuleFile("Cursor", root, sharedModelRules),
          },
        ]
      : []),
    ...(hasTargetModel(args.models, "Windsurf")
      ? [
          {
            path: `${root}/.windsurf/rules/design-system.md`,
            content: formatAgentRuleFile("Windsurf", root, sharedModelRules),
          },
        ]
      : []),
    {
      path: `${root}/.claude/skills/${root}-figma-design-system/SKILL.md`,
      content: `# ${args.projectName} Figma Design System\n\nUse this skill when implementing UI from this Figma design system.\n\n## Read first\n- references/project.md\n- references/tokens.md\n- references/components.md\n\n## Rules\n- Match Figma component structure, spacing, typography, and variable names.\n- Prefer tokens over hardcoded values.\n- Preserve variant behavior and accessibility states.\n- Follow the shared AI operating rules below before editing.\n\n${sharedModelRules}\n`,
    },
    {
      path: `${root}/.claude/skills/${root}-figma-design-system/references/project.md`,
      content: `# Project\n\nName: ${args.projectName}\nOwner: ${DEFAULT_OWNER_NAME}\nContact: ${DEFAULT_OWNER_CONTACT}\nIndustry: ${args.industry}\nDesign style: ${args.style}\nOpen Design preset: ${args.preset.label}\nFigma file: ${args.snapshot?.fileName ?? "Unknown"}\nFigma page: ${args.snapshot?.pageName ?? "Unknown"}\nAI-readiness score: ${args.scanResult?.score ?? "Not scanned"}\n\n## Open Design Direction\n${formatOpenDesignPreset(args.preset)}\n`,
    },
    {
      path: `${root}/.claude/skills/${root}-figma-design-system/references/tokens.md`,
      content: `# Tokens\n\nThis file links to the shared token source used by every component document.\n\n- Markdown: design-system/tokens/variables.md\n- JSON: design-system/tokens/tokens.json\n- CSS custom properties: design-system/tokens/tokens.css\n- Color reference: design-system/tokens/colors.md\n\n${formatVariables(variables)}\n`,
    },
    {
      path: `${root}/.claude/skills/${root}-figma-design-system/references/components.md`,
      content: `# Components\n\nTotal synced components: ${components.length}\n\nEvery component follows this structure: Figma MCP & Code Mapping, Description & Usage, When to use, Variants, Sizes, States, Icon Configuration, Design Tokens, File Structure Rules, Accessibility Rules, and Implementation Notes.\n\nWhen Figma MCP is connected, agents may edit the referenced Figma node directly. Without write access, treat Figma IDs as read-only design truth and edit the suggested code path instead.\n\n## Atoms\n${formatDetailedComponents(grouped.atoms, variables)}\n\n## Molecules\n${formatDetailedComponents(grouped.molecules, variables)}\n\n## Organisms\n${formatDetailedComponents(grouped.organisms, variables)}\n\n## All Components Index\n${formatAllComponents(components)}\n`,
    },
    {
      path: `${root}/design-system/README.md`,
      content: `# ${args.projectName} Design System\n\nThis folder trains Claude Code, Codex, Cursor, Windsurf, and Figma Make from the current Figma file.\n\n## Identity\n- Owner: ${DEFAULT_OWNER_NAME}\n- Contact: ${DEFAULT_OWNER_CONTACT}\n\n## Categories\n- Industry: ${args.industry}\n- Design style: ${args.style}\n- Open Design preset: ${args.preset.label}\n- Target models: ${args.models.join(", ")}\n\n${formatReadinessScores(readinessScores)}\n\n## Open Design Direction\n${formatOpenDesignPreset(args.preset)}\n\n## Shared source of truth\n- Component specs: components/all.md, components/atoms.md, components/molecules.md, components/organisms.md\n- Code Connect plan: code-connect.md\n- Machine-readable manifest: component-manifest.json\n- Tokens: tokens/variables.md, tokens/tokens.json, tokens/tokens.css, tokens/colors.md\n- File structure: file-structure.md\n\n## Quality gate\nRead ../design.md before implementation. Any generated interface should score at least 7/10 on each UI criterion.\n\n## Figma Make\nRead figma/make.md for detailed editable-generation rules.\n`,
    },
    {
      path: `${root}/design.md`,
      content: formatDesignDecisionsMd({
        projectName: args.projectName,
        industry: args.industry,
        style: args.style,
        preset: args.preset,
        uiAudit,
        readinessScores,
        variables,
        components,
      }),
    },
    {
      path: `${root}/design-system/component-manifest.json`,
      content: `${JSON.stringify(componentManifest, null, 2)}\n`,
    },
    {
      path: `${root}/design-system/code-connect.md`,
      content: formatCodeConnectMd(components, variables),
    },
    {
      path: `${root}/design-system/code-connect-cli.md`,
      content: formatCodeConnectCliMd(components),
    },
    {
      path: `${root}/design-system/component-diff.md`,
      content: formatComponentDiffReport(components, variables),
    },
    {
      path: `${root}/design-system/repo-patch-plan.md`,
      content: formatRepoPatchPlan(components, variables),
    },
    {
      path: `${root}/design-system/mcp-mode.md`,
      content: formatMcpModeMd(root),
    },
    {
      path: `${root}/design-system/figma/visual-preview-templates.md`,
      content: formatVisualPreviewTemplates(args.projectName, args.layoutTemplate, args.preset),
    },
    {
      path: `${root}/app-generation/live-preview.md`,
      content: formatLivePreviewFlowMd({
        projectName: args.projectName,
        root,
        layoutTemplate: args.layoutTemplate,
        components,
        variables,
      }),
    },
    {
      path: `${root}/agent-knowledge/runtime-automation.md`,
      content: formatRuntimeAutomationMd({
        projectName: args.projectName,
        root,
        uiAudit,
      }),
    },
    {
      path: `${root}/quality/visual-diff.md`,
      content: formatVisualDiffMd({
        root,
        layoutTemplate: args.layoutTemplate,
      }),
    },
    {
      path: `${root}/quality/verification-checklist.md`,
      content: formatVerificationChecklistMd({
        root,
        layoutTemplate: args.layoutTemplate,
      }),
    },
    {
      path: `${root}/quality/export-evidence.schema.json`,
      content: formatExportEvidenceSchema({
        projectName: args.projectName,
        layoutTemplate: args.layoutTemplate,
      }),
    },
    {
      path: `${root}/scripts/designready-audit.mjs`,
      content: formatDesignReadyAuditScript(root),
    },
    {
      path: `${root}/.github/workflows/designready-audit.yml`,
      content: formatDesignReadyWorkflow(),
    },
    {
      path: `${root}/playwright.designready.config.ts`,
      content: formatPlaywrightDesignReadyConfig(),
    },
    {
      path: `${root}/tests/designready-visual.spec.ts`,
      content: formatDesignReadyVisualSpec(),
    },
    {
      path: `${root}/design-system/tokens/variables.md`,
      content: `# Figma Variables\n\nAll components must reference this shared token source. Keep this file aligned with tokens.json and tokens.css.\n\n## Linked files\n- tokens.json: machine-readable token source\n- tokens.css: CSS custom properties for implementation\n- colors.md: color-only reference\n\n${formatVariables(variables)}\n`,
    },
    {
      path: `${root}/design-system/tokens/tokens.json`,
      content: formatTokensJson(variables),
    },
    {
      path: `${root}/design-system/tokens/tokens.css`,
      content: formatTokensCss(variables),
    },
    {
      path: `${root}/design-system/tokens/colors.md`,
      content: `# Color Tokens\n\nUse these shared color tokens in every component. Do not introduce new hex values unless the Figma file is updated first.\n\n${formatColorTokens(variables)}\n`,
    },
    {
      path: `${root}/design-system/file-structure.md`,
      content: `# File Structure Rules\n\n## Component folders\nEach component should live in a predictable folder:\n\n\`\`\`text\nsrc/components/<component-slug>/\n  <ComponentName>.tsx\n  <ComponentName>.module.css\n  <ComponentName>.test.tsx\n  <ComponentName>.stories.tsx\n  index.ts\n\`\`\`\n\n## Token files\n- Use design-system/tokens/tokens.json for machine-readable token values.\n- Use design-system/tokens/tokens.css for CSS custom properties.\n- Use design-system/tokens/colors.md for color decisions.\n\n## Documentation rules\n- Update atoms.md, molecules.md, organisms.md, and all.md after every Figma sync.\n- Preserve existing decisions unless the Figma file changed.\n- Never rename or delete tokens without confirmation.\n- Keep Claude Code, Codex, and Figma Make references linked to the same token files.\n`,
    },
    {
      path: `${root}/design-system/components/all.md`,
      content: `# All Figma Components\n\nTotal synced components: ${components.length}\n\nUse each component's Figma MCP & Code Mapping block to decide whether to edit the Figma node through MCP or the code component through Claude/Codex.\n\n${formatDetailedComponents(components, variables)}\n\n## Page Index\n${formatAllComponents(components)}\n`,
    },
    {
      path: `${root}/design-system/components/pages.md`,
      content: `# Figma Pages\n\nTotal pages: ${args.snapshot?.pages.length ?? 0}\nTotal synced components: ${components.length}\n\n${formatComponentPages(args.snapshot)}\n`,
    },
    {
      path: `${root}/design-system/components/atoms.md`,
      content: `# Atoms\n\nSynced atoms: ${grouped.atoms.length}\nTotal components in file: ${components.length}\n\n${formatDetailedComponents(grouped.atoms, variables)}\n`,
    },
    {
      path: `${root}/design-system/components/molecules.md`,
      content: `# Molecules\n\nSynced molecules: ${grouped.molecules.length}\nTotal components in file: ${components.length}\n\n${formatDetailedComponents(grouped.molecules, variables)}\n`,
    },
    {
      path: `${root}/design-system/components/organisms.md`,
      content: `# Organisms\n\nSynced organisms: ${grouped.organisms.length}\nTotal components in file: ${components.length}\n\n${formatDetailedComponents(grouped.organisms, variables)}\n`,
    },
    {
      path: `${root}/design-system/figma/snapshot.md`,
      content: `# Figma Snapshot\n\nFile: ${args.snapshot?.fileName ?? "Unknown"}\nScope: ${args.snapshot?.pageName ?? "Unknown"}\nPages: ${args.snapshot?.pages.length ?? 0}\nComponents: ${components.length}\nVariables: ${variables.length}\n\n## Pages\n${formatComponentPages(args.snapshot)}\n\n## Sync diagnostics\n\`\`\`text\n${formatDiagnostics(args.snapshot) || "No diagnostics available."}\n\`\`\`\n\n## AI prompt\n\n\`\`\`text\n${aiPrompt}\n\`\`\`\n`,
    },
    {
      path: `${root}/design-system/figma/make.md`,
      content: formatFigmaMakeMd({
        projectName: args.projectName,
        industry: args.industry,
        style: args.style,
        preset: args.preset,
        snapshot: args.snapshot,
        uiAudit,
        variables,
        components,
      }),
    },
    {
      path: `${root}/prompts/ai-training.md`,
      content: `# AI Training Prompt\n\n\`\`\`text\n${aiPrompt}\n\`\`\`\n\n${sharedModelRules}\n`,
    },
    ...agentKnowledgeFiles,
  ];
}

function sortMarkdownFiles(files: ProjectFile[], root: string): ProjectFile[] {
  const rank = (path: string) => {
    const relative = path.replace(`${root}/`, "");
    const depth = relative.split("/").length;
    const name = relative.split("/").pop() ?? relative;
    const priorityNames = ["design.md", "make.md", "CLAUDE.md", "AGENTS.md", "README.md", "file-structure.md"];
    const priority = priorityNames.indexOf(name);
    return {
      group: depth === 1 ? 0 : relative.startsWith("design-system/") ? 1 : 2,
      priority: priority === -1 ? priorityNames.length : priority,
      relative,
    };
  };

  return [...files].sort((a, b) => {
    const left = rank(a.path);
    const right = rank(b.path);
    if (left.group !== right.group) return left.group - right.group;
    if (left.priority !== right.priority) return left.priority - right.priority;
    return left.relative.localeCompare(right.relative);
  });
}

function estimateTokens(files: ProjectFile[]): number {
  return Math.ceil(files.reduce((sum, file) => sum + file.content.length, 0) / 4);
}

function formatTokenEstimate(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}K`;
  return `${value}`;
}

function downloadProject(files: ProjectFile[], projectName: string) {
  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(projectName)}-ai-design-system.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getComponentByMappingKey(components: DesignSystemComponentInfo[], key: string): DesignSystemComponentInfo | undefined {
  return components.find((component) => getComponentMappingKey(component) === key);
}

export function DesignProjectPanel({ snapshot, isLoading, error, scanResult, onRefresh }: DesignProjectPanelProps) {
  const [projectName, setProjectName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [style, setStyle] = useState(DESIGN_STYLES[0]);
  const [presetId, setPresetId] = useState(OPEN_DESIGN_PRESETS[0].id);
  const [layoutTemplate, setLayoutTemplate] = useState(LAYOUT_TEMPLATES[0]);
  const [models, setModels] = useState<string[]>(MODEL_TARGETS);
  const [useStarter, setUseStarter] = useState(false);
  const [created, setCreated] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isExportingFrame, setIsExportingFrame] = useState(false);
  const [copied, setCopied] = useState(false);
  const [frameExportStatus, setFrameExportStatus] = useState<string | null>(null);
  const [templateComponentMappings, setTemplateComponentMappings] = useState<Record<string, string[]>>({});
  const [baDocument, setBaDocument] = useState<BADocument | null>(null);
  const [standards, setStandards] = useState<StandardItem[]>([]);

  const handleBAChange = useCallback((doc: BADocument) => setBaDocument(doc), []);
  const handleStandardsChange = useCallback((items: StandardItem[]) => setStandards(items), []);

  const effectiveProjectName = projectName || snapshot?.fileName || "Design System";
  const selectedPreset = useMemo(
    () => OPEN_DESIGN_PRESETS.find((preset) => preset.id === presetId) ?? OPEN_DESIGN_PRESETS[0],
    [presetId],
  );

  const files = useMemo(
    () =>
      buildProjectFiles({
        projectName: effectiveProjectName,
        industry,
        style,
        preset: selectedPreset,
        layoutTemplate,
        models,
        snapshot,
        useStarter,
        scanResult,
      }),
    [effectiveProjectName, industry, layoutTemplate, models, scanResult, selectedPreset, snapshot, style, useStarter],
  );
  const root = files[0]?.path.split("/")[0] ?? "design-system";
  const markdownFiles = useMemo(() => sortMarkdownFiles(files.filter((file) => file.path.endsWith(".md")), root), [files, root]);
  const variables = useMemo(
    () => useStarter && (snapshot?.variables.length ?? 0) === 0 ? STARTER_VARIABLES : snapshot?.variables ?? [],
    [snapshot?.variables, useStarter],
  );
  const components = useMemo(
    () => withStarterMolecules(snapshot?.components ?? [], useStarter),
    [snapshot?.components, useStarter],
  );
  const templateSections = useMemo(() => getTemplateSectionDefinitions(layoutTemplate), [layoutTemplate]);
  const aiPrompt = buildAiPrompt(effectiveProjectName, industry, style, selectedPreset, models, root);
  const tokenEstimate = estimateTokens(files);
  const uiAudit = useMemo(() => buildUiAudit(scanResult, variables, components), [components, scanResult, variables]);
  const uiQualityScore = Math.round((uiAudit.reduce((sum, item) => sum + item.score, 0) / uiAudit.length) * 10) / 10;

  const toggleModel = (model: string) => {
    setModels((current) => {
      if (!current.includes(model)) return [...current, model];
      return current.length > 1 ? current.filter((item) => item !== model) : current;
    });
  };

  const addTemplateComponentMapping = (sectionTitle: string, key: string) => {
    if (!key) return;
    setTemplateComponentMappings((current) => {
      const existing = current[sectionTitle] ?? [];
      if (existing.includes(key)) return current;
      return { ...current, [sectionTitle]: [...existing, key] };
    });
  };

  const removeTemplateComponentMapping = (sectionTitle: string, key: string) => {
    setTemplateComponentMappings((current) => {
      const nextValues = (current[sectionTitle] ?? []).filter((item) => item !== key);
      const next = { ...current };
      if (nextValues.length > 0) {
        next[sectionTitle] = nextValues;
      } else {
        delete next[sectionTitle];
      }
      return next;
    });
  };

  const moveTemplateComponentMapping = (sectionTitle: string, key: string, direction: -1 | 1) => {
    setTemplateComponentMappings((current) => {
      const values = [...(current[sectionTitle] ?? [])];
      const index = values.indexOf(key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= values.length) return current;
      [values[index], values[targetIndex]] = [values[targetIndex], values[index]];
      return { ...current, [sectionTitle]: values };
    });
  };

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg || msg.type !== "figma-project-frame-result") return;
      setIsExportingFrame(false);
      setFrameExportStatus(msg.message);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const createProject = () => {
    setIsCreating(true);
    setCreated(false);
    window.setTimeout(() => {
      setCreated(true);
      setIsCreating(false);
    }, 650);
  };

  const exportFigmaFrame = () => {
    setIsExportingFrame(true);
    setFrameExportStatus(null);
    parent.postMessage(
      {
        pluginMessage: {
          type: "create-figma-project-frame",
          project: {
            projectName: effectiveProjectName,
            industry,
            style,
            presetName: selectedPreset.label,
            layoutTemplate,
            components,
            variables,
            templateComponentMappings: buildTemplateComponentMappings(templateSections, templateComponentMappings),
          },
        },
      },
      "*",
    );
  };

  const { t } = useI18n();

  const WORKFLOW_STEPS = [
    { id: "setup", label: t.projectSetup, icon: "1" },
    { id: "review", label: t.reviewOverview, icon: "2" },
    { id: "quality", label: t.qualityStandards, icon: "3" },
    { id: "content", label: t.contentGeneration, icon: "4" },
    { id: "export", label: t.exportDeliver, icon: "5" },
  ] as const;

  const currentStep = !created ? 0 : 1;

  return (
    <div className="design-project">
      {/* ── Workflow Progress ── */}
      {created && (
        <div className="wf-progress">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.id} className={`wf-step ${i < currentStep ? "done" : ""}`}>
              <span className="wf-num">{step.icon}</span>
              <span className="wf-label">{step.label}</span>
              {i < WORKFLOW_STEPS.length - 1 && <span className="wf-line" />}
            </div>
          ))}
        </div>
      )}

      {/* ══════════ STEP 1: PROJECT SETUP ══════════ */}
      <section className="design-config">
        <div className="design-config-header">
          <div>
            <h2>
              <span className="step-badge">{t.step1}</span>
              {t.projectSetup}
            </h2>
            <p className="step-hint">{t.step1Hint}</p>
          </div>
          <button className={`btn-secondary btn-sm sync-figma-button ${isLoading ? "loading" : ""}`} onClick={onRefresh} disabled={isLoading}>
            {isLoading && <span className="button-spinner" aria-hidden />}
            {isLoading ? t.syncing : t.syncFigma}
          </button>
        </div>

        {error && <div className="design-error">{error}</div>}
        {!error && !isLoading && snapshot && (
          <div className="design-sync-status">
            {t.syncedStatus(snapshot.components.length, snapshot.pages.length, snapshot.variables.length)}
          </div>
        )}
        {!error && !isLoading && snapshot?.components.length === 0 && snapshot.diagnostics && (
          <pre className="design-diagnostics">{formatDiagnostics(snapshot)}</pre>
        )}

        <div className="design-form-grid">
          <label className="design-field">
            <span>{t.projectName}</span>
            <input value={effectiveProjectName} onChange={(event) => setProjectName(event.target.value)} placeholder={t.projectName} />
          </label>
          <label className="design-field">
            <span>{t.category}</span>
            <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
              {INDUSTRIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="design-field">
            <span>{t.designStyle}</span>
            <select value={style} onChange={(event) => setStyle(event.target.value)}>
              {DESIGN_STYLES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="design-field">
            <span>{t.openDesignPreset}</span>
            <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
              {OPEN_DESIGN_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} - {preset.category}
                </option>
              ))}
            </select>
          </label>
          <label className="design-field">
            <span>{t.layoutTemplate}</span>
            <select value={layoutTemplate} onChange={(event) => setLayoutTemplate(event.target.value)}>
              {LAYOUT_TEMPLATES.map((template) => <option key={template}>{template}</option>)}
            </select>
          </label>
          <div className="design-field">
            <span>{t.languageModels}</span>
            <div className="model-toggle-row">
              {MODEL_TARGETS.map((model) => (
                <button
                  key={model}
                  className={`model-toggle ${models.includes(model) ? "active" : ""}`}
                  onClick={() => toggleModel(model)}
                  type="button"
                >
                  {model}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(components.length === 0 || variables.length === 0) && (
          <div className="design-empty-suggestion">
            <span>Figma file is missing {components.length === 0 ? t.missingComponents : ""}{components.length === 0 && variables.length === 0 ? t.missingBoth : ""}{variables.length === 0 ? t.missingVariables : ""}.</span>
            <button className="btn-link" onClick={() => setUseStarter(true)}>{t.useStarterProposal}</button>
          </div>
        )}

        <button className={`btn-primary create-project-button ${isCreating ? "loading" : ""}`} onClick={createProject} disabled={isCreating || isLoading}>
          {isCreating && <span className="button-spinner light" aria-hidden />}
          {isCreating ? t.creating : t.createProject}
        </button>
      </section>

      {created && (
        <div className="wf-flow created">

          {/* ══════════ STEP 2: REVIEW ══════════ */}
          <div className="wf-section">
            <div className="wf-section-header">
              <span className="step-badge">{t.step2}</span>
              <h3>{t.reviewOverview}</h3>
              <p className="step-hint">{t.step2Hint}</p>
            </div>

            <div className="wf-row-2">
              <section className="design-card">
                <span className="design-card-label">{t.dashboard}</span>
                <div className="design-metrics">
                  <Metric label={t.components} value={snapshot?.components.length ?? 0} />
                  <Metric label={t.pages} value={snapshot?.pages.length ?? 0} />
                  <Metric label={t.variables} value={variables.length} />
                  <Metric label={t.files} value={markdownFiles.length} />
                  <Metric label={t.tokens} value={formatTokenEstimate(tokenEstimate)} />
                  <Metric label={t.uiScore} value={uiQualityScore} suffix="/10" />
                </div>
                <div className="ui-audit-list">
                  {(snapshot?.pages ?? []).map((page) => (
                    <div key={page.id} className="ui-audit-row">
                      <span>{page.name}</span>
                      <strong>{page.componentCount}</strong>
                    </div>
                  ))}
                  {(snapshot?.pages.length ?? 0) === 0 && (
                    <div className="ui-audit-row">
                      <span>{t.noPagesYet}</span>
                      <strong>0</strong>
                    </div>
                  )}
                </div>
              </section>

              <section className="design-card">
                <span className="design-card-label">{t.variables}</span>
                <div className="variable-list">
                  {variables.slice(0, 14).map((variable) => (
                    <div key={variable.id} className="variable-row">
                      <span className="variable-name">{variable.name}</span>
                      <span className="variable-value">{variable.value}</span>
                    </div>
                  ))}
                  {variables.length > 14 && <span className="variable-more">{t.moreVariables(variables.length - 14)}</span>}
                </div>
              </section>
            </div>

            <div className="wf-row-2">
              <section className="design-card">
                <span className="design-card-label">{t.folderStructure}</span>
                <div className="folder-tree">
                  <div className="folder-root">{root}/</div>
                  {markdownFiles.map((file) => (
                    <div key={file.path} className="folder-file">
                      {file.path.replace(`${root}/`, "")}
                    </div>
                  ))}
                </div>
              </section>

              <section className="design-card">
                <span className="design-card-label">{t.templateMapping}</span>
                <div className="template-mapping-list">
                  {templateSections.map((section) => {
                    const selectedKeys = templateComponentMappings[section.title] ?? [];
                    const suggested = getSuggestedComponentForSection(section, components);
                    return (
                      <div className="template-mapping-row" key={section.title}>
                        <span>{section.title}</span>
                        <select value="" onChange={(event) => addTemplateComponentMapping(section.title, event.target.value)}>
                          <option value="">
                            {t.addComponent}{suggested ? ` - auto: ${suggested.name}` : ""}
                          </option>
                          {components.map((component) => {
                            const key = getComponentMappingKey(component);
                            return (
                              <option key={key} value={key} disabled={selectedKeys.includes(key)}>
                                {component.name} - {component.role ?? "unknown"} - {component.source ?? "unknown"}
                              </option>
                            );
                          })}
                        </select>
                        <div className="mapping-order-list">
                          {selectedKeys.map((key, index) => {
                            const component = getComponentByMappingKey(components, key);
                            return (
                              <div className="mapping-order-item" key={key}>
                                <strong>{index + 1}</strong>
                                <span>{component ? `${component.name} - ${component.role ?? "unknown"} - ${component.source ?? "unknown"}` : key}</span>
                                <button type="button" onClick={() => moveTemplateComponentMapping(section.title, key, -1)} disabled={index === 0}>{t.up}</button>
                                <button type="button" onClick={() => moveTemplateComponentMapping(section.title, key, 1)} disabled={index === selectedKeys.length - 1}>{t.down}</button>
                                <button type="button" onClick={() => removeTemplateComponentMapping(section.title, key)}>{t.remove}</button>
                              </div>
                            );
                          })}
                          {selectedKeys.length === 0 && <div className="mapping-empty">{t.autoMatch}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mapping-note">{t.mappingNote}</div>
              </section>
            </div>
          </div>

          {/* ══════════ STEP 3: QUALITY ══════════ */}
          <div className="wf-section">
            <div className="wf-section-header">
              <span className="step-badge">{t.step3}</span>
              <h3>{t.qualityStandards}</h3>
              <p className="step-hint">{t.step3Hint}</p>
            </div>

            <UiUxEvaluationPanel
              components={components}
              variables={variables}
              scanResult={scanResult}
            />

            <div className="wf-row-2">
              <section className="design-card">
                <span className="design-card-label">{t.uiAuditScores}</span>
                <div className="ui-audit-list" style={{ maxHeight: "none" }}>
                  {uiAudit.map((item) => (
                    <div key={item.id} className="ui-audit-row">
                      <span>{item.label}</span>
                      <strong className={item.score >= 7 ? "score-good" : item.score >= 5 ? "score-warn" : "score-bad"}>{item.score}/10</strong>
                    </div>
                  ))}
                </div>
              </section>

              <StandardsChecklist onStandardsChange={handleStandardsChange} />
            </div>
          </div>

          {/* ══════════ STEP 4: CONTENT ══════════ */}
          <div className="wf-section">
            <div className="wf-section-header">
              <span className="step-badge">{t.step4}</span>
              <h3>{t.contentGeneration}</h3>
              <p className="step-hint">{t.step4Hint}</p>
            </div>

            <BADocumentPanel
              onDocumentChange={handleBAChange}
              initialDoc={baDocument}
            />

            <ScreenGenPanel
              components={components}
              variables={variables}
              baDocument={baDocument}
              standards={standards}
              layoutTemplate={layoutTemplate}
              projectName={effectiveProjectName}
              industry={industry}
              style={style}
            />
          </div>

          {/* ══════════ STEP 5: EXPORT ══════════ */}
          <div className="wf-section">
            <div className="wf-section-header">
              <span className="step-badge">{t.step5}</span>
              <h3>{t.exportDeliver}</h3>
              <p className="step-hint">{t.step5Hint}</p>
            </div>

            <ExportHub
              onDownloadProject={() => downloadProject(files, projectName || "design-system")}
              onExportFigmaFrame={exportFigmaFrame}
              onCopyPrompt={copyPrompt}
              onExportBAReport={() => {
                const report = buildBAReport(uiAudit, standards, baDocument, effectiveProjectName);
                const blob = new Blob([report], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${effectiveProjectName.replace(/\s+/g, "-").toLowerCase()}-ba-report.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              isExporting={isExportingFrame}
              isCopied={copied}
              frameStatus={frameExportStatus}
              tokenEstimate={tokenEstimate}
              fileCount={markdownFiles.length}
            />

            <section className="design-card">
              <span className="design-card-label">{t.aiPromptPreview}</span>
              <pre className="prompt-preview">
                {aiPrompt.length > PROMPT_PREVIEW_LIMIT ? `${aiPrompt.slice(0, PROMPT_PREVIEW_LIMIT)}\n\n${t.previewTruncated}` : aiPrompt}
              </pre>
            </section>
          </div>

        </div>
      )}
    </div>
  );
}

function buildBAReport(
  uiAudit: { id: string; label: string; score: number; rationale: string }[],
  standards: StandardItem[],
  baDocument: BADocument | null,
  projectName: string,
): string {
  let md = `# ${projectName} — BA & UI/UX Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += `## UI/UX Audit\n\n`;
  md += `| Criterion | Score | Notes |\n|---|---|---|\n`;
  for (const item of uiAudit) {
    md += `| ${item.label} | ${item.score}/10 | ${item.rationale} |\n`;
  }

  const checked = standards.filter(s => s.checked);
  const unchecked = standards.filter(s => !s.checked);
  md += `\n## Standards Compliance\n\n`;
  md += `### Met (${checked.length})\n`;
  for (const s of checked) md += `- [x] ${s.label}\n`;
  md += `\n### Not Met (${unchecked.length})\n`;
  for (const s of unchecked) md += `- [ ] ${s.label}${s.required ? " ⚠️ REQUIRED" : ""}\n`;

  if (baDocument?.content) {
    md += `\n## BA Document: ${baDocument.title}\n\n`;
    md += baDocument.content.slice(0, 3000);
    if (baDocument.content.length > 3000) md += `\n\n... (truncated)`;
  }

  return md;
}

function Metric({ label, value, suffix = "" }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="design-metric">
      <strong>{value}{suffix}</strong>
      <span>{label}</span>
    </div>
  );
}
