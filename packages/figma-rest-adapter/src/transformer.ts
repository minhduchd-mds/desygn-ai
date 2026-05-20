/**
 * transformer — Walk a Figma REST API document tree and emit AuditNode[].
 *
 * Server-side equivalent of the plugin-side serializer. Computes the
 * minimum fields required by audit rules:
 *   - contrastRatio (text nodes)
 *   - hasInteractions (heuristic: COMPONENT/INSTANCE with "button"/"link" naming)
 *   - touchTargetCompliant
 *   - inferredRole
 *   - headingLevel (for text styled as H1-H6)
 */

import type { AuditNode } from "@desygn/audit-engine";

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: { width: number; height: number };
  characters?: string;
  style?: { fontSize?: number; fontWeight?: number };
  fills?: Array<{ color?: { r: number; g: number; b: number; a?: number } }>;
  backgrounds?: Array<{ color?: { r: number; g: number; b: number; a?: number } }>;
  componentId?: string;
  componentSetId?: string;
}

interface TransformContext {
  pageName: string;
}

export function transformFigmaToAuditNodes(
  document: unknown,
  options: { maxDepth?: number } = {},
): AuditNode[] {
  const result: AuditNode[] = [];
  const maxDepth = options.maxDepth ?? 15;

  // Walk top-level pages (canvases)
  if (
    typeof document === "object" &&
    document !== null &&
    "children" in document
  ) {
    const pages = (document as { children?: FigmaNode[] }).children ?? [];
    for (const page of pages) {
      if (page.type !== "CANVAS") continue;
      walkNode(page, { pageName: page.name }, result, 0, maxDepth);
    }
  }

  return result;
}

function walkNode(
  node: FigmaNode,
  ctx: TransformContext,
  out: AuditNode[],
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) return;
  if (node.visible === false) return;

  const auditNode = toAuditNode(node, ctx);
  if (auditNode) out.push(auditNode);

  if (node.children) {
    for (const child of node.children) {
      walkNode(child, ctx, out, depth + 1, maxDepth);
    }
  }
}

function toAuditNode(node: FigmaNode, ctx: TransformContext): AuditNode | null {
  if (node.type === "CANVAS" || node.type === "DOCUMENT") return null;

  const width = node.absoluteBoundingBox?.width;
  const height = node.absoluteBoundingBox?.height;
  const hasInteractions = inferInteractive(node);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    pageName: ctx.pageName,
    width,
    height,
    text: node.characters,
    hasInteractions,
    inferredRole: inferRole(node, hasInteractions),
    touchTargetCompliant:
      width !== undefined && height !== undefined ? Math.min(width, height) >= 24 : undefined,
    headingLevel: inferHeadingLevel(node),
    contrastRatio: undefined, // TODO Week 4: compute from fills/backgrounds
    hasMotion: false,         // TODO Week 4: detect via reactions
  };
}

function inferInteractive(node: FigmaNode): boolean {
  const name = node.name.toLowerCase();
  const KEYWORDS = ["button", "btn", "link", "input", "checkbox", "radio", "switch", "tab", "menu"];
  if (KEYWORDS.some((k) => name.includes(k))) return true;
  // COMPONENT/INSTANCE often interactive
  if ((node.type === "COMPONENT" || node.type === "INSTANCE") && KEYWORDS.some((k) => name.includes(k))) {
    return true;
  }
  return false;
}

function inferRole(node: FigmaNode, isInteractive: boolean): string {
  const name = node.name.toLowerCase();
  if (name.includes("button") || name.includes("btn")) return "button";
  if (name.includes("link")) return "link";
  if (name.includes("input") || name.includes("textfield")) return "textbox";
  if (name.includes("checkbox")) return "checkbox";
  if (name.includes("radio")) return "radio";
  if (name.includes("switch") || name.includes("toggle")) return "switch";
  if (name.includes("tab")) return "tab";
  if (name.includes("menu")) return "menu";
  if (name.includes("dialog") || name.includes("modal")) return "dialog";
  if (isInteractive) return "button";
  return "unknown";
}

function inferHeadingLevel(node: FigmaNode): number | undefined {
  if (node.type !== "TEXT") return undefined;
  const name = node.name.toLowerCase();
  const match = /h([1-6])/.exec(name);
  if (match) return parseInt(match[1], 10);

  // Heuristic: font size brackets
  const size = node.style?.fontSize;
  if (typeof size === "number") {
    if (size >= 40) return 1;
    if (size >= 32) return 2;
    if (size >= 24) return 3;
    if (size >= 20) return 4;
  }
  return undefined;
}
