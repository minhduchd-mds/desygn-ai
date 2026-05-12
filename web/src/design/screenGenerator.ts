import type { DesignContext, Screen } from "../../../shared/designContext";
import { getCached, setCached } from "../lib/requestCache";
import { SCREEN_NAMES } from "./constants";
import { loadDesignMdTemplate } from "./templateRegistry";

export type { Screen } from "../../../shared/designContext";

function extractComponentNames(markdown: string): string[] {
  return Array.from(
    new Set(
      markdown
        .split("\n")
        .map((line) => line.match(/^\|\s*([^|]+?)\s*\|/)?.[1]?.trim())
        .filter((value): value is string => !!value && !/^component$/i.test(value) && !/^-+$/.test(value)),
    ),
  );
}

function extractColorTokens(markdown: string): string[] {
  return Array.from(new Set(markdown.match(/--[a-z0-9-]+/gi) ?? []));
}

function createSkeletonScreen(name: string, context: DesignContext): Screen {
  const components = context.components.map((component) => component.componentName || component.name).filter(Boolean).slice(0, 5);
  const markdown = `## Screen: ${name}

### Purpose
Define the ${name} experience for the selected project.

### Layout
- Grid: ${context.layoutPattern?.columns ?? 1}
- Nav: ${context.layoutPattern?.navPosition ?? "none"}
- Key regions: Header, content, primary action, feedback state

### Components
| Component | Variant | Props |
|-----------|---------|-------|
${(components.length > 0 ? components : ["Button", "Card", "Input"]).map((component) => `| ${component} | Default | TBD |`).join("\n")}

### Color tokens
- --color-primary: Primary actions
- --color-surface: Page and panel surfaces
- --color-border: Separators and controls

### Spacing
- Use an 8px base spacing scale.
- Keep form rows and action groups stable across breakpoints.

### Interactions
- Show loading, empty, error, success, and disabled states.
- Keep destructive actions behind confirmation.
`;

  return {
    name,
    markdown,
    components,
    colorTokens: extractColorTokens(markdown),
  };
}

export function parseScreensFromMarkdown(markdown: string): Screen[] {
  return markdown
    .split(/(?=^## Screen:\s+)/gm)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("## Screen:"))
    .map((section) => {
      const name = section.match(/^## Screen:\s+(.+)$/m)?.[1]?.trim() ?? "Untitled";
      return {
        name,
        markdown: section,
        components: extractComponentNames(section),
        colorTokens: extractColorTokens(section),
      };
    });
}

async function getSelectedTemplateLabel(context: DesignContext): Promise<string> {
  const template = context.selectedTemplateId ? await loadDesignMdTemplate(context.selectedTemplateId) : null;
  return template?.label ?? context.selectedTemplateId ?? "Unselected";
}

async function callGenerateScreensApi(context: DesignContext): Promise<string> {
  const selectedTemplateLabel = await getSelectedTemplateLabel(context);
  const cacheKey = { context, selectedTemplateLabel };
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const response = await fetch("/api/generate-screens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context, selectedTemplateLabel }),
  });

  if (!response.ok) throw new Error(`Screen generation failed with ${response.status}.`);
  const result = await response.json() as { markdown?: string };
  if (!result.markdown) throw new Error("Screen generation returned no text content.");
  setCached(cacheKey, result.markdown);
  return result.markdown;
}

export async function generateScreens(context: DesignContext): Promise<Screen[]> {
  try {
    const markdown = await callGenerateScreensApi(context);
    const screens = parseScreensFromMarkdown(markdown);
    return screens.length === 5 ? screens : SCREEN_NAMES.map((name) => createSkeletonScreen(name, context));
  } catch {
    return SCREEN_NAMES.map((name) => createSkeletonScreen(name, context));
  }
}
