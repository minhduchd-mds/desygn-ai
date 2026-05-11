export interface DesignMdTemplate {
  id: string;
  label: string;
  markdown: string;
  readme?: string;
}

export interface DesignMdTemplateMeta {
  id: string;
  label: string;
  category: DesignMdTemplateCategory;
  priority: "Product" | "Technical";
  keywords: string[];
}

export type DesignMdTemplateCategory =
  | "AI"
  | "Automotive"
  | "Commerce"
  | "Developer"
  | "Finance"
  | "Media"
  | "Product"
  | "Workspace";

const designModules = import.meta.glob("../design-md-templates/*/DESIGN.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

function folderName(path: string): string {
  return path.split("/").at(-2) ?? "template";
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "template";
}

function formatLabel(value: string): string {
  return value
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bIbm\b/g, "IBM")
    .replace(/\bX AI\b/g, "xAI");
}

const CATEGORY_KEYWORDS: Record<DesignMdTemplateCategory, string[]> = {
  AI: ["claude", "cohere", "elevenlabs", "mistral", "minimax", "ollama", "opencode", "openai", "replicate", "runwayml", "together", "voltagent", "x-ai"],
  Automotive: ["bmw", "bugatti", "ferrari", "lamborghini", "renault", "tesla"],
  Commerce: ["airbnb", "mastercard", "nike", "shopify", "starbucks", "stripe"],
  Developer: ["cal", "clickhouse", "composio", "cursor", "expo", "github", "hashicorp", "mongodb", "sentry", "supabase", "vercel", "warp", "webflow"],
  Finance: ["binance", "coinbase", "kraken", "revolut", "wise"],
  Media: ["pinterest", "playstation", "spotify", "theverge", "wired"],
  Product: ["apple", "figma", "framer", "linear", "lovable", "meta", "miro", "notion", "posthog", "raycast", "resend", "sanity", "slack", "superhuman", "uber", "zapier"],
  Workspace: ["airtable", "ba-agent-workflow", "business-analyst", "clay", "ibm", "mintlify", "nvidia", "vodafone"],
};

function inferCategory(id: string): DesignMdTemplateCategory {
  return (
    Object.entries(CATEGORY_KEYWORDS).find(([, keywords]) => keywords.some((keyword) => id.includes(keyword)))?.[0] as
      | DesignMdTemplateCategory
      | undefined
  ) ?? "Product";
}

function inferPriority(category: DesignMdTemplateCategory): "Product" | "Technical" {
  return ["AI", "Developer", "Workspace"].includes(category) ? "Technical" : "Product";
}

function inferKeywords(id: string, label: string, category: DesignMdTemplateCategory): string[] {
  const baseKeywords = [category.toLowerCase(), inferPriority(category).toLowerCase()];
  return Array.from(new Set([...id.split("-"), ...label.toLowerCase().split(/\s+/), ...baseKeywords])).filter(Boolean);
}

const templatePathById = new Map<string, string>();

export const DESIGN_MD_TEMPLATES: DesignMdTemplateMeta[] = Object.keys(designModules)
  .map((path) => {
    const folder = folderName(path);
    const id = normalizeId(folder);
    const label = formatLabel(folder);
    const category = inferCategory(id);
    templatePathById.set(id, path);
    return {
      id,
      label,
      category,
      priority: inferPriority(category),
      keywords: inferKeywords(id, label, category),
    };
  })
  .sort((left, right) => left.label.localeCompare(right.label));

export function hasDesignMdTemplate(id: string): boolean {
  return templatePathById.has(id);
}

export async function loadDesignMdTemplate(id: string): Promise<DesignMdTemplate | null> {
  const path = templatePathById.get(id);
  if (!path) return null;

  const markdown = await designModules[path]();
  const meta = DESIGN_MD_TEMPLATES.find((template) => template.id === id);

  return {
    id,
    label: meta?.label ?? formatLabel(folderName(path)),
    markdown,
  };
}
