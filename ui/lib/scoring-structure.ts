import type { SerializedNode, ScanIssue } from "../../shared/types";
import { buildPath } from "./utils";
import { MAX_OPTIMAL_NESTING, MAX_DEEP_NESTING } from "../../shared/constants";

interface StructureResult {
  score: number;
  issues: ScanIssue[];
}

interface WalkState {
  totalFrames: number;
  autoLayoutFrames: number;
  absoluteFrames: number;
  maxDepth: number;
  hasGrid: boolean;
  issues: ScanIssue[];
}

// Mutable ancestors array — push/pop instead of [...spread] per node.
// Reduces allocations from O(n × depth) to O(depth).
function walkTree(node: SerializedNode, ancestors: string[], depth: number, state: WalkState): void {
  if (depth > state.maxDepth) state.maxDepth = depth;
  const isFrame = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET";
  if (isFrame) {
    state.totalFrames++;
    if (node.layoutMode) {
      state.autoLayoutFrames++;
    } else {
      state.absoluteFrames++;
      const childCount = node.children?.length ?? 0;
      if (childCount > 1) {
        state.issues.push({
          id: `structure-no-autolayout-${node.id}`,
          category: "structure",
          severity: "info",
          message: `"${node.name}" uses absolute positioning with ${childCount} children. AI will infer layout direction from child positions.`,
          path: buildPath(ancestors, node.name),
          suggestion:
            "For best results, use Auto Layout (Shift+A) in Figma. The prompt includes position data as fallback.",
          nodeId: node.id,
        });
      }
    }
    if (depth <= 1 && node.layoutGrids && node.layoutGrids.length > 0) {
      state.hasGrid = true;
    }
  }
  if (depth > MAX_OPTIMAL_NESTING && isFrame && !node.isComponent && !node.isInstance) {
    state.issues.push({
      id: `structure-deep-nesting-${node.id}`,
      category: "structure",
      severity: "info",
      message: `"${node.name}" is nested ${depth} levels deep. Deep nesting increases AI token cost and can confuse layout interpretation.`,
      path: buildPath(ancestors, node.name),
      suggestion: "Consider flattening the hierarchy if intermediate wrappers are unnecessary.",
      nodeId: node.id,
    });
  }
  if (node.type === "GROUP" && (node.children?.length ?? 0) > 2) {
    state.issues.push({
      id: `structure-group-${node.id}`,
      category: "structure",
      severity: "info",
      message: `"${node.name}" is a Group with ${node.children!.length} children. Groups have no layout semantics — AI will treat children as absolutely positioned.`,
      path: buildPath(ancestors, node.name),
      suggestion: "Convert to a Frame with Auto Layout for better AI-readable structure.",
      nodeId: node.id,
    });
  }
  if (node.children) {
    ancestors.push(node.name);
    for (const child of node.children) {
      walkTree(child, ancestors, depth + 1, state);
    }
    ancestors.pop();
  }
}

export function scoreStructure(node: SerializedNode): StructureResult {
  const state: WalkState = {
    totalFrames: 0,
    autoLayoutFrames: 0,
    absoluteFrames: 0,
    maxDepth: 0,
    hasGrid: false,
    issues: [],
  };
  walkTree(node, [], 0, state);
  let score = 50;
  if (state.totalFrames === 0) return { score: 50, issues: state.issues };
  const autoLayoutRatio = state.autoLayoutFrames / state.totalFrames;
  if (autoLayoutRatio >= 0.9) score += 35;
  else if (autoLayoutRatio >= 0.7) score += 25;
  else if (autoLayoutRatio >= 0.5) score += 15;
  else if (autoLayoutRatio >= 0.3) score += 5;
  else score -= 5;
  if (node.layoutMode) {
    score += 10;
  } else {
    score -= 3;
    if (state.totalFrames > 1) {
      state.issues.push({
        id: `structure-root-no-autolayout-${node.id}`,
        category: "structure",
        severity: "warning",
        message: `Root frame "${node.name}" has no Auto Layout. AI will infer flex direction from child positions and spacing.`,
        path: node.name,
        suggestion:
          "For best results, add Auto Layout (Shift+A) to the root frame. The prompt includes position data as fallback.",
        nodeId: node.id,
      });
    }
  }
  if (state.hasGrid) {
    score += 5;
  } else if (node.width && node.width >= 768) {
    state.issues.push({
      id: `structure-no-grid-${node.id}`,
      category: "structure",
      severity: "info",
      message: `"${node.name}" is a wide frame (${node.width}px) without a Layout Grid. A grid helps AI generate accurate column-based layouts.`,
      path: node.name,
      suggestion: "Add a Layout Grid (e.g. 12 columns) to define the page structure.",
      nodeId: node.id,
    });
  }
  if (state.maxDepth > MAX_DEEP_NESTING) score -= 5;
  return { score: Math.max(0, Math.min(100, score)), issues: state.issues };
}
