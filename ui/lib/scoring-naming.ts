import type { SerializedNode, ScanIssue } from "../../shared/types";
import { buildPath } from "./utils";
import { MAX_SHORT_NAME_LENGTH } from "../../shared/constants";

// Single combined regex replacing 18 separate patterns — O(1) test instead of O(18).
// Matches Figma default layer names like "Frame 1", "Group", "Rectangle 42", etc.
const GENERIC_NAME_RE =
  /^(Frame|Group|Rectangle|Ellipse|Line|Vector|Star|Polygon|Image|Text|Slice|Component|Boolean|Union|Subtract|Intersect|Exclude)\s*\d*$/i;

interface NamingResult {
  score: number;
  issues: ScanIssue[];
  stats: { total: number; generic: number; semantic: number };
}

function isGenericName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_SHORT_NAME_LENGTH && !/^(ok|no|go|hr)$/i.test(trimmed)) return true;
  return GENERIC_NAME_RE.test(trimmed);
}

function suggestName(node: SerializedNode): string | undefined {
  if (node.type === "TEXT" && node.characters) {
    const words = node.characters.trim().split(/\s+/).slice(0, 3).join("-").toLowerCase();
    return words.length > 30 ? words.slice(0, 30) : words;
  }
  if (node.isInstance && node.componentName) {
    return node.componentName.toLowerCase().replace(/\s+/g, "-");
  }
  if (node.children && node.children.length > 0) {
    const hasText = node.children.some((c) => c.type === "TEXT");
    const hasImage = node.children.some((c) => c.type === "RECTANGLE" && c.fills?.some((f) => f.type === "IMAGE"));
    if (node.layoutMode === "HORIZONTAL") {
      if (hasText && hasImage) return "media-row";
      return "h-stack";
    }
    if (node.layoutMode === "VERTICAL") {
      if (hasText) return "content-block";
      return "v-stack";
    }
  }
  if (node.type === "RECTANGLE" && node.fills?.some((f) => f.type === "IMAGE")) return "image";
  if (node.type === "RECTANGLE") {
    if (node.width && node.height && (node.height <= 2 || node.width <= 2)) return "divider";
    return "shape";
  }
  return undefined;
}

// Mutable ancestors array — push/pop instead of [...spread] per node.
// Reduces memory allocations from O(n × depth) to O(depth).
function walkTree(
  node: SerializedNode,
  ancestors: string[],
  issues: ScanIssue[],
  stats: { total: number; generic: number; semantic: number },
): void {
  stats.total++;
  if (isGenericName(node.name)) {
    stats.generic++;
    const suggestion = suggestName(node);
    issues.push({
      id: `naming-generic-${node.id}`,
      category: "naming",
      severity: "warning",
      message:
        node.name.trim().length <= MAX_SHORT_NAME_LENGTH
          ? `"${node.name}" is too short to be meaningful. AI cannot infer the purpose of this layer.`
          : `"${node.name}" is a generic Figma default name. AI cannot infer the purpose of this layer.`,
      path: buildPath(ancestors, node.name),
      suggestion: suggestion
        ? `Rename to "${suggestion}"`
        : "Give this layer a descriptive, semantic name (e.g. hero-cta-button, profile-avatar)",
      nodeId: node.id,
    });
  } else {
    stats.semantic++;
  }
  if (node.children) {
    ancestors.push(node.name);
    for (const child of node.children) {
      walkTree(child, ancestors, issues, stats);
    }
    ancestors.pop();
  }
}

export function scoreNaming(node: SerializedNode): NamingResult {
  const issues: ScanIssue[] = [];
  const stats = { total: 0, generic: 0, semantic: 0 };
  walkTree(node, [], issues, stats);
  if (stats.total === 0) return { score: 100, issues, stats };
  const semanticRatio = stats.semantic / stats.total;
  const score = Math.round(semanticRatio * 100);
  if (semanticRatio < 0.5) {
    const criticalCount = Math.min(3, issues.length);
    for (let i = 0; i < criticalCount; i++) {
      issues[i].severity = "critical";
      issues[i].message = issues[i].message.replace("AI cannot infer", "AI will not be able to infer");
    }
  }
  return { score, issues, stats };
}
