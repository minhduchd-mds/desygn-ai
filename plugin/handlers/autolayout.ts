import type { PluginMessage, AutoLayoutCandidate, AutoLayoutSkipped } from "../../shared/types";
import { sendSelection } from "./selection";

// ── Analysis ──

interface ChildInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  hasChildren: boolean;
  node: SceneNode;
}

function getVisibleChildren(frame: FrameNode | ComponentNode | GroupNode): ChildInfo[] {
  return frame.children
    .filter((c) => c.visible && "x" in c && "width" in c)
    .map((c) => ({
      x: Math.round(c.x),
      y: Math.round(c.y),
      width: Math.round(c.width),
      height: Math.round(c.height),
      type: c.type,
      hasChildren: "children" in c && (c as FrameNode).children.length > 0,
      node: c as SceneNode,
    }));
}

function hasOverlap(children: ChildInfo[]): boolean {
  for (let i = 0; i < children.length; i++) {
    for (let j = i + 1; j < children.length; j++) {
      const a = children[i];
      const b = children[j];
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlapX && overlapY) return true;
    }
  }
  return false;
}

function detectDirection(children: ChildInfo[]): "HORIZONTAL" | "VERTICAL" | null {
  if (children.length < 2) return null;

  const sorted = [...children];
  const sortedByY = sorted.sort((a, b) => a.y - b.y);
  const sortedByX = [...children].sort((a, b) => a.x - b.x);

  // Check vertical: are children stacked top to bottom?
  let isVertical = true;
  for (let i = 1; i < sortedByY.length; i++) {
    const prev = sortedByY[i - 1];
    const curr = sortedByY[i];
    // Current top should be >= previous bottom (allow small overlap tolerance)
    if (curr.y < prev.y + prev.height - 2) {
      isVertical = false;
      break;
    }
  }

  // Check horizontal: are children laid out left to right?
  let isHorizontal = true;
  for (let i = 1; i < sortedByX.length; i++) {
    const prev = sortedByX[i - 1];
    const curr = sortedByX[i];
    if (curr.x < prev.x + prev.width - 2) {
      isHorizontal = false;
      break;
    }
  }

  if (isVertical && !isHorizontal) return "VERTICAL";
  if (isHorizontal && !isVertical) return "HORIZONTAL";

  // Both or neither — use spread
  const xSpread = Math.max(...children.map((c) => c.x + c.width)) - Math.min(...children.map((c) => c.x));
  const ySpread = Math.max(...children.map((c) => c.y + c.height)) - Math.min(...children.map((c) => c.y));

  if (ySpread > xSpread * 1.2) return "VERTICAL";
  if (xSpread > ySpread * 1.2) return "HORIZONTAL";

  return null; // ambiguous
}

function calculateGap(children: ChildInfo[], direction: "HORIZONTAL" | "VERTICAL"): number {
  const sorted =
    direction === "HORIZONTAL"
      ? [...children].sort((a, b) => a.x - b.x)
      : [...children].sort((a, b) => a.y - b.y);

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap =
      direction === "HORIZONTAL"
        ? curr.x - (prev.x + prev.width)
        : curr.y - (prev.y + prev.height);
    gaps.push(Math.max(0, Math.round(gap)));
  }

  if (gaps.length === 0) return 0;

  // Use median gap for robustness
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  return sortedGaps[Math.floor(sortedGaps.length / 2)];
}

function calculatePadding(
  frame: { width: number; height: number },
  children: ChildInfo[],
): { top: number; right: number; bottom: number; left: number } {
  const minX = Math.min(...children.map((c) => c.x));
  const minY = Math.min(...children.map((c) => c.y));
  const maxX = Math.max(...children.map((c) => c.x + c.width));
  const maxY = Math.max(...children.map((c) => c.y + c.height));

  return {
    top: Math.max(0, Math.round(minY)),
    right: Math.max(0, Math.round(frame.width - maxX)),
    bottom: Math.max(0, Math.round(frame.height - maxY)),
    left: Math.max(0, Math.round(minX)),
  };
}

// ── Alignment detection ──
// Two separate functions: one for primary (main) axis, one for counter (cross)
// axis. Operate on positions/sizes only — exported as pure helpers for tests.

export interface AlignmentChild {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaddingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ALIGN_TOL = 2;
const ALIGN_CENTER_TOL = 4;

export function detectPrimaryAlignment(
  children: AlignmentChild[],
  direction: "HORIZONTAL" | "VERTICAL",
  frameMain: number,
  padding: PaddingBox,
): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  if (children.length === 0) return "MIN";

  const isHoriz = direction === "HORIZONTAL";
  const padStart = isHoriz ? padding.left : padding.top;
  const padEnd = isHoriz ? padding.right : padding.bottom;

  const positions = children.map((c) => (isHoriz ? c.x : c.y));
  const sizes = children.map((c) => (isHoriz ? c.width : c.height));

  let firstIdx = 0;
  let lastIdx = 0;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[firstIdx]) firstIdx = i;
    if (positions[i] > positions[lastIdx]) lastIdx = i;
  }

  const firstAtStart = Math.abs(positions[firstIdx] - padStart) <= ALIGN_TOL;
  const lastAtEnd =
    Math.abs(positions[lastIdx] + sizes[lastIdx] - (frameMain - padEnd)) <= ALIGN_TOL;

  if (children.length >= 3 && firstAtStart && lastAtEnd) return "SPACE_BETWEEN";
  if (firstAtStart) return "MIN";
  if (lastAtEnd) return "MAX";

  // CENTER: bounding box of content centered between paddings
  const contentStart = positions[firstIdx];
  const contentEnd = positions[lastIdx] + sizes[lastIdx];
  const contentMid = (contentStart + contentEnd) / 2;
  const innerMid = padStart + (frameMain - padStart - padEnd) / 2;
  if (Math.abs(contentMid - innerMid) <= ALIGN_CENTER_TOL) return "CENTER";

  return "MIN";
}

export function detectCounterAlignment(
  children: AlignmentChild[],
  direction: "HORIZONTAL" | "VERTICAL",
  frameCross: number,
  padding: PaddingBox,
): "MIN" | "CENTER" | "MAX" {
  if (children.length === 0) return "MIN";

  const isHoriz = direction === "HORIZONTAL";
  // Cross axis is the perpendicular one to direction
  const padStart = isHoriz ? padding.top : padding.left;
  const padEnd = isHoriz ? padding.bottom : padding.right;

  const positions = children.map((c) => (isHoriz ? c.y : c.x));
  const sizes = children.map((c) => (isHoriz ? c.height : c.width));

  // MIN: all start at padStart
  if (positions.every((p) => Math.abs(p - padStart) <= ALIGN_TOL)) return "MIN";

  // MAX: all end at frameCross - padEnd
  if (
    positions.every(
      (p, i) => Math.abs(p + sizes[i] - (frameCross - padEnd)) <= ALIGN_TOL,
    )
  ) {
    return "MAX";
  }

  // CENTER: each child's mid-point ≈ inner cross center
  const innerCenter = padStart + (frameCross - padStart - padEnd) / 2;
  if (
    positions.every(
      (p, i) => Math.abs(p + sizes[i] / 2 - innerCenter) <= ALIGN_CENTER_TOL,
    )
  ) {
    return "CENTER";
  }

  return "MIN";
}

// ── Child sizing decision ──
// Per spec: children of an Auto Layout frame must NEVER carry FIXED pixel
// widths/heights — only FILL or HUG. Exception: nodes that cannot hug content
// (empty Frames, RECTANGLE/ELLIPSE/VECTOR shapes) would collapse to 0×0 if
// set to HUG, so they fall back to FIXED. This is documented and intentional.

export function canHugContent(type: string, hasChildren: boolean): boolean {
  if (type === "TEXT") return true;
  if (type === "INSTANCE") return true;
  return hasChildren;
}

export interface ChildSizingInput {
  width: number;
  height: number;
  type: string;
  hasChildren: boolean;
}

const FILL_TOL = 4;

export function decideChildSizing(
  child: ChildSizingInput,
  direction: "HORIZONTAL" | "VERTICAL",
  innerWidth: number,
  innerHeight: number,
): { horizontal: "FILL" | "HUG" | "FIXED"; vertical: "FILL" | "HUG" | "FIXED" } {
  const canHug = canHugContent(child.type, child.hasChildren);
  const fallback: "HUG" | "FIXED" = canHug ? "HUG" : "FIXED";

  let horizontal: "FILL" | "HUG" | "FIXED";
  let vertical: "FILL" | "HUG" | "FIXED";

  if (direction === "HORIZONTAL") {
    // main = horizontal, cross = vertical
    horizontal = fallback;
    vertical = Math.abs(child.height - innerHeight) <= FILL_TOL ? "FILL" : fallback;
  } else {
    // main = vertical, cross = horizontal
    vertical = fallback;
    horizontal = Math.abs(child.width - innerWidth) <= FILL_TOL ? "FILL" : fallback;
  }

  return { horizontal, vertical };
}

// ── Gap variance ──
// Gap between adjacent children along the main axis. Returns the spread
// (max gap − min gap). Used to detect "value-pinned-right" patterns: when
// SPACE_BETWEEN is geometrically detected but gaps are actually uneven,
// converting would reflow children (e.g. center a label that was originally
// next to its icon). Such candidates are skipped instead of converted.

export function gapVariance(
  children: AlignmentChild[],
  direction: "HORIZONTAL" | "VERTICAL",
): number {
  if (children.length < 3) return 0;
  const sorted =
    direction === "HORIZONTAL"
      ? [...children].sort((a, b) => a.x - b.x)
      : [...children].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const g =
      direction === "HORIZONTAL"
        ? curr.x - (prev.x + prev.width)
        : curr.y - (prev.y + prev.height);
    gaps.push(Math.round(g));
  }
  return Math.max(...gaps) - Math.min(...gaps);
}

const SPACE_BETWEEN_GAP_TOL = 8;

function calculateConfidence(
  children: ChildInfo[],
  direction: "HORIZONTAL" | "VERTICAL",
  gap: number,
): number {
  let confidence = 0.7; // base

  // Consistent gap → higher confidence
  const sorted =
    direction === "HORIZONTAL"
      ? [...children].sort((a, b) => a.x - b.x)
      : [...children].sort((a, b) => a.y - b.y);

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const g =
      direction === "HORIZONTAL"
        ? curr.x - (prev.x + prev.width)
        : curr.y - (prev.y + prev.height);
    gaps.push(Math.round(g));
  }

  if (gaps.length > 0) {
    const variance = gaps.reduce((sum, g) => sum + Math.abs(g - gap), 0) / gaps.length;
    if (variance <= 1) confidence += 0.2; // very consistent
    else if (variance <= 4) confidence += 0.1;
    else confidence -= 0.1; // inconsistent
  }

  // More children → slightly higher confidence (clearer pattern)
  if (children.length >= 3) confidence += 0.05;

  // Gap on 4px grid → bonus
  if (gap % 4 === 0) confidence += 0.05;

  return Math.min(1, Math.max(0, Math.round(confidence * 100) / 100));
}

function analyzeFrame(
  node: SceneNode,
  depth: number,
  candidates: AutoLayoutCandidate[],
  skipped: AutoLayoutSkipped[],
): void {
  // Only analyze frames without auto layout
  const isFrame = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET";
  if (!isFrame) return;

  const frame = node as FrameNode;

  // Recurse into children first (bottom-up)
  if ("children" in frame) {
    for (const child of frame.children) {
      analyzeFrame(child, depth + 1, candidates, skipped);
    }
  }

  // Skip if already has auto layout
  if (frame.layoutMode && frame.layoutMode !== "NONE") return;

  // Skip instances (can't modify internals)
  if ((node as SceneNode).type === "INSTANCE") return;

  const children = getVisibleChildren(frame);

  // Skip single or no children
  if (children.length < 2) {
    if (children.length === 1) {
      skipped.push({
        nodeId: node.id,
        name: node.name,
        reason: "Only 1 visible child — no layout pattern to detect",
      });
    }
    return;
  }

  // Skip overlapping children
  if (hasOverlap(children)) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: "Children overlap — likely decorative positioning",
    });
    return;
  }

  // Skip icon/illustration frames: all children are shapes (no frames, text, or instances)
  const SHAPE_TYPES = new Set(["VECTOR", "LINE", "ELLIPSE", "RECTANGLE", "STAR", "POLYGON", "BOOLEAN_OPERATION"]);
  const allShapes = children.every((c) => SHAPE_TYPES.has(c.node.type));
  if (allShapes) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: "All children are shapes — likely an icon or illustration",
    });
    return;
  }

  // Detect direction
  const direction = detectDirection(children);
  if (!direction) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: "Ambiguous layout — can't determine row vs column",
    });
    return;
  }

  const gap = calculateGap(children, direction);
  const padding = calculatePadding(
    { width: Math.round(frame.width), height: Math.round(frame.height) },
    children,
  );
  const frameMain = direction === "HORIZONTAL" ? Math.round(frame.width) : Math.round(frame.height);
  const alignment = detectPrimaryAlignment(children, direction, frameMain, padding);
  const confidence = calculateConfidence(children, direction, gap);

  // Skip "value-pinned-right" patterns: SPACE_BETWEEN is geometrically detected
  // (first child at start, last at end) but gaps are very uneven, suggesting
  // the design is really MIN-aligned content with the last item pinned to the
  // far edge. Auto Layout can't preserve this without restructuring (e.g.
  // wrapping the first N children in a group), so we leave the frame untouched.
  if (alignment === "SPACE_BETWEEN" && gapVariance(children, direction) > SPACE_BETWEEN_GAP_TOL) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason:
        "Uneven gaps suggest a 'value-pinned-right' pattern — group related children manually first, then re-scan",
    });
    return;
  }

  // Only include if confidence is high enough
  if (confidence < 0.6) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: `Low confidence (${Math.round(confidence * 100)}%) — inconsistent spacing`,
    });
    return;
  }

  candidates.push({
    nodeId: node.id,
    name: node.name,
    depth,
    direction,
    gap,
    padding,
    alignment,
    childCount: children.length,
    confidence,
  });
}

// ── Apply ──

function applyAutoLayout(nodeIds: Set<string>): number {
  let count = 0;

  // Collect all candidate nodes with their analysis
  const nodesToConvert: { node: FrameNode; depth: number }[] = [];
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return 0;

  // Per spec, ONLY the user-selected outermost frame is allowed to keep FIXED
  // sizing. Everything inside must be FILL or HUG. The outermost is selection[0]
  // (and only if it's a candidate; otherwise no candidate is "outermost").
  const outermostId = selection[0].id;

  function collectNodes(node: SceneNode, depth: number) {
    if (nodeIds.has(node.id) && (node.type === "FRAME" || node.type === "COMPONENT")) {
      nodesToConvert.push({ node: node as FrameNode, depth });
    }
    if ("children" in node) {
      for (const child of (node as FrameNode).children) {
        collectNodes(child, depth + 1);
      }
    }
  }

  collectNodes(selection[0], 0);

  // Sort: deepest first (bottom-up)
  nodesToConvert.sort((a, b) => b.depth - a.depth);

  // Cache pre-conversion sizes so a parent's children-loop can detect cross-axis
  // FILL using the child's *original* dimensions, not its post-HUG shrunken size.
  const origSizes = new Map<string, { width: number; height: number }>();

  for (const { node: frame } of nodesToConvert) {
    // Re-read children at apply time. Bottom-up traversal means inner frames
    // may have already been converted to Auto Layout in earlier iterations.
    const children = getVisibleChildren(frame);
    if (children.length < 2) continue;

    const direction = detectDirection(children);
    if (!direction) continue;

    // Snapshot original frame size BEFORE setting layoutMode.
    const origWidth = Math.round(frame.width);
    const origHeight = Math.round(frame.height);
    origSizes.set(frame.id, { width: origWidth, height: origHeight });

    const gap = calculateGap(children, direction);
    const padding = calculatePadding(
      { width: origWidth, height: origHeight },
      children,
    );
    const frameMain = direction === "HORIZONTAL" ? origWidth : origHeight;
    const frameCross = direction === "HORIZONTAL" ? origHeight : origWidth;
    const primaryAlign = detectPrimaryAlignment(children, direction, frameMain, padding);
    const counterAlign = detectCounterAlignment(children, direction, frameCross, padding);

    // ── Set Auto Layout container properties ──
    frame.layoutMode = direction;
    frame.itemSpacing = gap;
    frame.paddingTop = padding.top;
    frame.paddingRight = padding.right;
    frame.paddingBottom = padding.bottom;
    frame.paddingLeft = padding.left;
    frame.primaryAxisAlignItems = primaryAlign;
    frame.counterAxisAlignItems = counterAlign;

    // ── Children sizing per spec ──
    // FILL on cross-axis if child matches frame's inner cross, else HUG (or
    // FIXED only for nodes that can't hug content — empty Frames, RECTANGLE,
    // VECTOR, etc. — which would collapse to 0×0). Main axis prefers HUG.
    const innerWidth = origWidth - padding.left - padding.right;
    const innerHeight = origHeight - padding.top - padding.bottom;

    for (const childInfo of children) {
      const child = childInfo.node;
      if (!("layoutSizingHorizontal" in child)) continue;

      // Use original size for already-converted descendants (their current size
      // may have shrunk after HUG was applied in their own apply-step).
      const childOrig = origSizes.get(child.id);
      const childWidth = childOrig?.width ?? childInfo.width;
      const childHeight = childOrig?.height ?? childInfo.height;

      const sizing = decideChildSizing(
        {
          width: childWidth,
          height: childHeight,
          type: childInfo.type,
          hasChildren: childInfo.hasChildren,
        },
        direction,
        innerWidth,
        innerHeight,
      );

      try {
        (child as FrameNode).layoutSizingHorizontal = sizing.horizontal;
        (child as FrameNode).layoutSizingVertical = sizing.vertical;
      } catch {
        // Some node types reject certain sizing modes (e.g. rotated nodes).
      }
    }

    // ── Frame self-sizing ──
    // Per spec: ONLY the user-selected outermost frame keeps FIXED. Everything
    // else must be FILL or HUG.
    if (frame.id === outermostId) {
      frame.layoutSizingHorizontal = "FIXED";
      frame.layoutSizingVertical = "FIXED";
      frame.resize(origWidth, origHeight);
    } else {
      // Non-outermost: try to size relative to the parent (if parent has Auto
      // Layout already — e.g. a pre-existing AL frame the user manually set up).
      // If parent is a candidate, it hasn't been applied yet (bottom-up); its
      // children-loop will overwrite our HUG default with FILL/HUG when it runs.
      const parent = frame.parent;
      const parentHasAL =
        parent &&
        "layoutMode" in parent &&
        (parent as FrameNode).layoutMode &&
        (parent as FrameNode).layoutMode !== "NONE";

      if (parentHasAL) {
        const p = parent as FrameNode;
        const pInnerWidth = Math.round(p.width) - p.paddingLeft - p.paddingRight;
        const pInnerHeight = Math.round(p.height) - p.paddingTop - p.paddingBottom;
        const sizing = decideChildSizing(
          {
            width: origWidth,
            height: origHeight,
            type: frame.type,
            hasChildren: frame.children.length > 0,
          },
          p.layoutMode as "HORIZONTAL" | "VERTICAL",
          pInnerWidth,
          pInnerHeight,
        );
        try {
          frame.layoutSizingHorizontal = sizing.horizontal;
          frame.layoutSizingVertical = sizing.vertical;
        } catch {
          frame.layoutSizingHorizontal = "HUG";
          frame.layoutSizingVertical = "HUG";
        }
      } else {
        // Parent has no AL yet (it's a candidate to be applied later, or it's
        // not a frame at all). Default HUG-HUG; parent's children-loop will
        // override if parent is a candidate.
        frame.layoutSizingHorizontal = "HUG";
        frame.layoutSizingVertical = "HUG";
      }
    }

    count++;
  }

  return count;
}

// ── Message Handler ──

export async function handleAutoLayoutMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "request-autolayout-analysis": {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) return true;

      const candidates: AutoLayoutCandidate[] = [];
      const skipped: AutoLayoutSkipped[] = [];
      analyzeFrame(selection[0], 0, candidates, skipped);

      // Sort candidates by depth (deepest first for display)
      candidates.sort((a, b) => b.depth - a.depth);

      const response: PluginMessage = { type: "autolayout-analysis-result", candidates, skipped };
      figma.ui.postMessage(response);
      return true;
    }
    case "apply-autolayout": {
      const nodeIdSet = new Set(msg.nodeIds);
      const count = applyAutoLayout(nodeIdSet);
      const response: PluginMessage = { type: "autolayout-applied", count };
      figma.ui.postMessage(response);
      sendSelection();
      return true;
    }
    default:
      return false;
  }
}
