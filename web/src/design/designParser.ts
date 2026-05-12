import type { AccountPlan, OpenDesignDefinition, OpenDesignPreset, ParsedDesignMd, ProjectRequest } from "../app/types";

interface CompetitorBenchmark {
  name: string;
  focus: string;
  gap: string;
  score: number;
}

function getSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`##\\s+${heading}[\\s\\S]*?(?=\\n##\\s+|$)`, "i");
  return markdown.match(pattern)?.[0] ?? "";
}

function stripMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[_#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDesignLabel(markdown: string): string {
  const overview = stripMarkdown(getSection(markdown, "Overview"));
  const canonicalMatch = overview.match(/^([A-Z][A-Za-z0-9.+-]{1,32})\s+is\s+/);
  if (canonicalMatch) return `${canonicalMatch[1]} imported`;
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  return headingMatch ? stripMarkdown(headingMatch[1]) : "Imported Design.md";
}

function extractListItems(section: string, fallback: string[]): string[] {
  const items = section
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.+)/)?.[1])
    .filter((value): value is string => !!value)
    .map((value) => stripMarkdown(value))
    .filter(Boolean);
  return items.length > 0 ? items.slice(0, 8) : fallback;
}

function extractPalette(markdown: string, fallback: string[]): string[] {
  const seen = new Set<string>();
  const colors = [...markdown.matchAll(/#[0-9a-fA-F]{6}\b/g)]
    .map((match) => match[0].toUpperCase())
    .filter((color) => {
      if (seen.has(color)) return false;
      seen.add(color);
      return true;
    });
  return colors.length > 0 ? colors.slice(0, 5) : fallback;
}

function extractTypography(markdown: string, fallback: string): string {
  const section = getSection(markdown, "Typography");
  const fontLine = section
    .split("\n")
    .map(stripMarkdown)
    .find((line) => /font|type|weight|display|body/i.test(line) && line.length > 48);
  return fontLine ?? fallback;
}

function extractLayout(markdown: string, fallback: string[]): string[] {
  const section = getSection(markdown, "Layout") || getSection(markdown, "Responsive Behavior");
  return extractListItems(section, fallback).slice(0, 5);
}

function extractElevation(markdown: string, fallback: string): string {
  const section = getSection(markdown, "Elevation");
  const line = section
    .split("\n")
    .map(stripMarkdown)
    .find((item) => /shadow|elevation|scrim|depth|flat/i.test(item) && item.length > 32);
  return line ?? fallback;
}

export function parseDesignMd(markdown: string, fallback: OpenDesignDefinition): ParsedDesignMd | null {
  if (!/##\s+Overview/i.test(markdown) && !/##\s+Colors/i.test(markdown) && !/##\s+Typography/i.test(markdown)) {
    return null;
  }

  const overview = stripMarkdown(getSection(markdown, "Overview"));
  const direction = overview ? overview.split(/(?<=\.)\s+/).slice(0, 3).join(" ") : fallback.direction;
  const componentsSection = getSection(markdown, "Components");
  const componentHeadings = [...componentsSection.matchAll(/^###\s+(.+)$/gm)].map((match) => stripMarkdown(match[1]));

  return {
    label: extractDesignLabel(markdown),
    direction,
    palette: extractPalette(markdown, fallback.palette),
    typography: extractTypography(markdown, fallback.typography),
    components: componentHeadings.length > 0 ? componentHeadings.slice(0, 8) : fallback.components,
    layout: extractLayout(markdown, fallback.layout),
    elevation: extractElevation(markdown, fallback.elevation),
    rules: extractListItems(getSection(markdown, "Key Characteristics") || getSection(markdown, "Principles"), fallback.rules).slice(0, 5),
    donts: fallback.donts,
  };
}

export function inferProjectName(prompt: string, category: string): string {
  const importedLabel = extractDesignLabel(prompt);
  if (importedLabel !== "Imported Design.md") return importedLabel.replace(/\s+imported$/i, " Web");
  const clean = prompt
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
  return clean ? clean.replace(/\b\w/g, (char) => char.toUpperCase()) : `AI Design Agent ${category}`;
}

export function buildDesignMd(
  request: ProjectRequest,
  plan: AccountPlan,
  presets: Record<OpenDesignPreset, OpenDesignDefinition>,
  benchmarks: CompetitorBenchmark[],
): string {
  const preset = presets[request.openDesign];
  const imported = parseDesignMd(request.prompt, preset);
  const design = imported ?? preset;
  const sourceNote = imported
    ? `- Source mode: imported markdown pasted by user\n- Imported design: ${imported.label}`
    : `- Source mode: Open Design preset\n- Open Design preset: ${preset.label}`;
  return `# ${request.projectName} Design.md

## Product Context
- Category: ${request.category}
- Style: ${request.style}
${sourceNote}
- Layout: ${request.layout}
- Target stack: ${request.target}
- Account plan: ${plan}

## User Request
${request.prompt}

## Visual Theme & Atmosphere
${design.direction}

## Color Palette & Roles
${design.palette.map((color, index) => `- Color ${index + 1}: ${color}`).join("\n")}

## Typography Rules
${design.typography}
- Do not make every label bold. Use normal body text, medium labels, and heavier weight only for primary headings or key metrics.
- Keep letter spacing at 0 except small uppercase metadata labels.
- Preserve readable line-height for generated long-form AI output.

## Component Stylings
${design.components.map((component) => `- ${component}`).join("\n")}

## Layout Principles
${design.layout.map((item) => `- ${item}`).join("\n")}

## Depth & Elevation
${design.elevation}

## Design Tokens
${preset.tokens.map((token) => `- ${token}`).join("\n")}

## Do's
${design.rules.map((rule) => `- ${rule}`).join("\n")}

## Don'ts
${design.donts.map((rule) => `- ${rule}`).join("\n")}

## AI Execution Guide
- Read this Design.md before editing code.
- Convert the user request into screens, components, states, and data examples.
- Generate a realistic preview first, then refine spacing, hierarchy, accessibility, and empty/error states.
- Explain assumptions inside the generated prompt, not as visible UI copy.
- Do not invent unsupported paid features; mark Pro-only items as "in development" until backend/payment is ready.
- Build actual workflows: landing, auth, chat workspace, output review, upgrade state.
- Before finalizing, verify text does not overlap controls and buttons keep stable dimensions.

## Competitor Benchmark
${benchmarks.map((item) => `- ${item.name}: ${item.focus}. Opportunity: ${item.gap}. Internal fit score: ${item.score}/100.`).join("\n")}

## Responsive Behavior
- Desktop: keep sidebar plus main workspace when width allows.
- Tablet: collapse secondary panels below the main composer.
- Mobile: single-column flow with sticky primary action and readable preview cards.
- Forms and generated prompts must remain usable without horizontal scrolling.

## Generated Web Scope
- Landing page explaining the software scenario and value.
- Login and registration with secure credential handling.
- Chat workspace for issuing project generation commands.
- Prompt output mode and realistic web preview mode.
- Free plan limits and Pro upgrade surface.
`;
}

export function buildPreviewText(request: ProjectRequest, presets: Record<OpenDesignPreset, OpenDesignDefinition>): string[] {
  const preset = presets[request.openDesign];
  const imported = parseDesignMd(request.prompt, preset);
  const design = imported ?? preset;
  return [
    `${imported ? "Imported Design.md" : "Open Design"}: ${design.label} - ${design.direction}`,
    "Landing: AI Design Agent hero, product story, use cases, pricing entry.",
    `Workspace: ${request.layout} interface with project prompt composer.`,
    `Output: ${request.target} project for ${request.category}.`,
    "Upgrade: Free account can preview core flows; Pro unlocks full generation when ready.",
  ];
}
