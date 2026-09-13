/**
 * autolayout/analysis — Frame child analysis and layout direction detection.
 *
 * Pure geometry functions that examine frame children positions to determine
 * if they form a HORIZONTAL or VERTICAL layout pattern.
 */

export interface ChildInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  hasChildren: boolean;
  node: SceneNode;
}

type GeometrySceneNode = SceneNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

function hasGeometry(node: SceneNode): node is GeometrySceneNode {
  return (
    node.visible &&
    "x" in node &&
    "y" in node &&
    "width" in node &&
    "height" in node &&
    typeof node.x === "number" &&
    typeof node.y === "number" &&
    typeof node.width === "number" &&
    typeof node.height === "number"
  );
}

export function getVisibleChildren(frame: FrameNode | ComponentNode | GroupNode): ChildInfo[] {
  return frame.children.filter(hasGeometry).map((child) => ({
    x: Math.round(child.x),
    y: Math.round(child.y),
    width: Math.round(child.width),
    height: Math.round(child.height),
    type: child.type,
    hasChildren: "children" in child && child.children.length > 0,
    node: child,
  }));
}

export function hasOverlap(children: ChildInfo[]): boolean {
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

export function detectDirection(children: ChildInfo[]): "HORIZONTAL" | "VERTICAL" | null {
  if (children.length < 2) return null;

  const sorted = [...children];
  const sortedByY = sorted.sort((a, b) => a.y - b.y);
  const sortedByX = [...children].sort((a, b) => a.x - b.x);

  let isVertical = true;
  for (let i = 1; i < sortedByY.length; i++) {
    const prev = sortedByY[i - 1];
    const curr = sortedByY[i];
    if (curr.y < prev.y + prev.height - 2) {
      isVertical = false;
      break;
    }
  }

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

  const xSpread = Math.max(...children.map((c) => c.x + c.width)) - Math.min(...children.map((c) => c.x));
  const ySpread = Math.max(...children.map((c) => c.y + c.height)) - Math.min(...children.map((c) => c.y));

  if (ySpread > xSpread * 1.2) return "VERTICAL";
  if (xSpread > ySpread * 1.2) return "HORIZONTAL";

  return null;
}

export function calculateGap(children: ChildInfo[], direction: "HORIZONTAL" | "VERTICAL"): number {
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

  const sortedGaps = [...gaps].sort((a, b) => a - b);
  return sortedGaps[Math.floor(sortedGaps.length / 2)];
}

export function calculatePadding(
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
