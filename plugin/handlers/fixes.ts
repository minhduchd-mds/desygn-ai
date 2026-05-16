import type { PluginMessage, RenameEntry } from "../../shared/types";
import { sendSelection } from "./selection";

// ── Generic name detection ──

const GENERIC_PATTERNS = [
  /^Frame\s*\d*$/i,
  /^Group\s*\d*$/i,
  /^Rectangle\s*\d*$/i,
  /^Ellipse\s*\d*$/i,
  /^Line\s*\d*$/i,
  /^Vector\s*\d*$/i,
  /^Star\s*\d*$/i,
  /^Polygon\s*\d*$/i,
  /^Image\s*\d*$/i,
  /^Text\s*\d*$/i,
  /^Slice\s*\d*$/i,
  /^Component\s*\d*$/i,
  /^Boolean\s*\d*$/i,
  /^Union\s*\d*$/i,
  /^Subtract\s*\d*$/i,
  /^Intersect\s*\d*$/i,
  /^Exclude\s*\d*$/i,
];

function isGenericName(name: string): boolean {
  const trimmed = name.trim();
  // Single character or very short non-semantic names
  if (trimmed.length <= 2 && !/^(ok|no|go|hr)$/i.test(trimmed)) return true;
  // Figma default patterns
  return GENERIC_PATTERNS.some((p) => p.test(trimmed));
}

function findSiblingTextContext(node: SceneNode): string | null {
  const parent = node.parent;
  if (!parent || !("children" in parent)) return null;

  const siblings = (parent as FrameNode).children.filter(
    (c: { id: string; visible: boolean }) => c.id !== node.id && c.visible,
  );

  // Collect text from sibling text nodes
  const texts: string[] = [];
  for (const sib of siblings) {
    if (sib.type === "TEXT") {
      const chars = (sib as TextNode).characters.trim();
      if (chars && chars.length <= 30) texts.push(chars);
    }
  }

  if (texts.length === 0) return null;

  // Slugify the shortest/most relevant text
  const best = texts.sort((a, b) => a.length - b.length)[0];
  return best
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("-");
}

function findSemanticAncestor(node: SceneNode): string | null {
  let current = node.parent;
  let depth = 0;
  while (current && depth < 4) {
    if ("name" in current && current.type !== "DOCUMENT" && current.type !== "PAGE") {
      const name = (current as SceneNode).name;
      if (!isGenericName(name) && name.length >= 2) {
        return name
          .toLowerCase()
          .replace(/[\s/]+/g, "-")
          .slice(0, 20);
      }
    }
    current = current.parent;
    depth++;
  }
  return null;
}

function suggestIconName(node: SceneNode): string {
  // 1. Try sibling text for context (most specific)
  const siblingText = findSiblingTextContext(node);
  if (siblingText && siblingText.length >= 2) {
    return `${siblingText}-icon`;
  }

  // 2. Try the closest semantic ancestor
  const ancestor = findSemanticAncestor(node);
  if (ancestor) {
    return `${ancestor}-icon`;
  }

  return "icon";
}

async function suggestName(node: SceneNode): Promise<string> {
  if (node.type === "TEXT") {
    const text = (node as TextNode).characters.trim();
    if (text) {
      const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .split(/\s+/)
        .slice(0, 3)
        .join("-");
      // Short slugs (≤2 chars) are still ambiguous — add parent context
      if (slug.length <= 2) {
        const parentName = findSemanticAncestor(node);
        if (parentName) return `${parentName}-label`;
        return `${slug}-label`;
      }
      return slug.length > 30 ? slug.slice(0, 30) : slug;
    }
    return "text";
  }

  if (node.type === "INSTANCE") {
    const comp = await (node as InstanceNode).getMainComponentAsync();
    if (comp) return comp.name.toLowerCase().replace(/[\s/]+/g, "-");
  }

  if ("fills" in node) {
    const fills = node.fills as readonly Paint[];
    if (fills && fills.length > 0 && fills.some((f) => f.type === "IMAGE")) {
      const parentName =
        node.parent && "name" in node.parent
          ? (node.parent as SceneNode).name
              .toLowerCase()
              .replace(/[\s/]+/g, "-")
              .slice(0, 20)
          : "";
      if (parentName && !isGenericName(parentName)) return `${parentName}-image`;
      return "thumbnail";
    }
  }

  if (node.type === "RECTANGLE") {
    if (node.height <= 2 || node.width <= 2) return "divider";
    return "shape";
  }

  if ("children" in node) {
    const children = (node as FrameNode).children.filter((c: { visible: boolean }) => c.visible);
    const hasText = children.some((c: { type: string }) => c.type === "TEXT");
    const hasImage = children.some(
      (c: { fills: readonly Paint[] }) =>
        "fills" in c && (c.fills as readonly Paint[]).some?.((f: Paint) => f.type === "IMAGE"),
    );

    // Icon detection: all children are shapes (vectors, lines, ellipses, etc.)
    const SHAPE_TYPES = new Set(["VECTOR", "LINE", "ELLIPSE", "RECTANGLE", "STAR", "POLYGON", "BOOLEAN_OPERATION"]);
    const allShapes = children.length > 0 && children.every((c: { type: string }) => SHAPE_TYPES.has(c.type));
    if (allShapes) {
      return suggestIconName(node);
    }

    if ("layoutMode" in node) {
      const layout = (node as FrameNode).layoutMode;
      if (layout === "HORIZONTAL") {
        if (hasText && hasImage) return "media-row";
        if (hasText) return "text-row";
        return "h-stack";
      }
      if (layout === "VERTICAL") {
        if (hasText) return "content-block";
        return "v-stack";
      }
    }

    if (hasText && hasImage) return "media-block";
    if (hasText) return "text-group";
    if (children.length > 0) return "container";
  }

  return "element";
}

async function collectRenames(node: SceneNode, ancestors: string[], results: RenameEntry[]): Promise<void> {
  if (isGenericName(node.name)) {
    const suggested = await suggestName(node);
    if (suggested.toLowerCase() !== node.name.toLowerCase()) {
      results.push({
        nodeId: node.id,
        oldName: node.name,
        newName: suggested,
        path: [...ancestors, node.name].join(" > "),
      });
    }
  }

  if ("children" in node) {
    for (const child of (node as FrameNode).children) {
      await collectRenames(child, [...ancestors, node.name], results);
    }
  }
}

async function applyRenames(entries: RenameEntry[]): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    const node = await figma.getNodeByIdAsync(entry.nodeId);
    if (node && "name" in node) {
      node.name = entry.newName;
      count++;
      if (count % 10 === 0) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }
  }
  return count;
}

async function convertDividers(nodeIds: string[]): Promise<number> {
  let count = 0;
  for (const id of nodeIds) {
    const target = await figma.getNodeByIdAsync(id);
    if (!target) continue;
    if (target.type !== "FRAME" && target.type !== "COMPONENT" && target.type !== "GROUP") continue;

    const frame = target as FrameNode;
    const fills = frame.fills as readonly Paint[];
    let strokeColor: RGB = { r: 0.81, g: 0.84, b: 0.9 };
    if (fills && fills.length > 0 && fills[0].type === "SOLID") {
      strokeColor = (fills[0] as SolidPaint).color;
    }

    frame.fills = [];
    frame.strokes = [{ type: "SOLID", color: strokeColor }];
    frame.strokeWeight = Math.max(1, Math.round(frame.height));
    frame.strokeAlign = "INSIDE";

    if (!frame.name.toLowerCase().includes("divider")) {
      frame.name = "divider";
    }
    count++;
  }
  return count;
}

export async function handleFixMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "request-renames": {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) return true;
      const entries: RenameEntry[] = [];
      await collectRenames(selection[0], [], entries);
      const response: PluginMessage = { type: "renames-result", entries };
      figma.ui.postMessage(response);
      return true;
    }
    case "apply-renames": {
      const count = await applyRenames(msg.entries);
      const applied: PluginMessage = { type: "renames-applied", count };
      figma.ui.postMessage(applied);
      await sendSelection();
      return true;
    }
    case "delete-nodes": {
      // Collect valid nodes first, then sort deepest-first to avoid
      // parent deletion invalidating child references
      const targets: SceneNode[] = [];
      for (const id of msg.nodeIds) {
        const target = await figma.getNodeByIdAsync(id);
        if (target && "remove" in target && target.type !== "DOCUMENT" && target.type !== "PAGE") {
          targets.push(target as SceneNode);
        }
      }

      // Sort by depth (deepest first) — children before parents
      function nodeDepth(node: BaseNode): number {
        let d = 0;
        let current = node.parent;
        while (current) {
          d++;
          current = current.parent;
        }
        return d;
      }
      targets.sort((a, b) => nodeDepth(b) - nodeDepth(a));

      let count = 0;
      const removed = new Set<string>();
      for (const target of targets) {
        // Skip if already removed (parent was deleted)
        if (removed.has(target.id)) continue;
        // Check node still exists in tree
        try {
          if (target.parent === null) continue; // already detached
          target.remove();
          removed.add(target.id);
          count++;
        } catch {
          // Node was already removed — skip
        }
      }
      const deleted: PluginMessage = { type: "nodes-deleted", count };
      figma.ui.postMessage(deleted);
      await sendSelection();
      return true;
    }
    case "convert-dividers": {
      const count = await convertDividers(msg.nodeIds);
      const converted: PluginMessage = { type: "dividers-converted", count };
      figma.ui.postMessage(converted);
      setTimeout(() => sendSelection(), 100);
      return true;
    }
    default:
      return false;
  }
}
