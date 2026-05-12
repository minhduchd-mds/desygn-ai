import type { SerializedNode, AtomicLevel, AtomicInfo, ExportPlanItem, DependencyNode } from "../../shared/types";

// Check if node is a component (instance or definition)
function isComponentNode(n: SerializedNode): boolean {
  return !!(n.isInstance || n.isComponent);
}

// Get display name for a component node
function componentDisplayName(n: SerializedNode): string {
  return n.componentName ?? n.name;
}

/**
 * Atomic Design classification based on Brad Frost:
 * - Atom: Component with no child components (Button, Icon, Badge)
 * - Molecule: Contains only atoms (SearchBar = Input + Button + Icon)
 * - Organism: Contains molecules or a mix of molecules + atoms (Header = Logo + Nav + SearchBar)
 * - Unclassified: Not a component (raw frame)
 *
 * Key insight: it's about NESTING DEPTH of components, not count.
 * Does any child-component itself contain components? → Organism.
 */

interface AtomicData {
  componentCount: number;
  containsMolecules: boolean; // true if any child component itself contains components
  maxFrameDepth: number;
  subComponents: string[];
}

function collectAtomicData(root: SerializedNode): AtomicData {
  let componentCount = 0;
  let containsMolecules = false;
  let maxFrameDepth = 0;
  const subSeen = new Set<string>();
  const subs: string[] = [];

  // Cache: node id → whether it contains any component descendant.
  // Populated during the single walk pass, so hasNestedComponents never re-walks the same subtree.
  const nestedComponentCache = new Map<string, boolean>();

  function hasNestedComponents(n: SerializedNode): boolean {
    const cached = nestedComponentCache.get(n.id);
    if (cached !== undefined) return cached;
    let result = false;
    if (n.children) {
      for (const child of n.children) {
        if (child.visible === false) continue;
        if (isComponentNode(child) || hasNestedComponents(child)) {
          result = true;
          break;
        }
      }
    }
    nestedComponentCache.set(n.id, result);
    return result;
  }

  function walk(n: SerializedNode, depth: number): void {
    if (n.visible === false) return;
    if (depth > maxFrameDepth) maxFrameDepth = depth;

    if (n !== root && isComponentNode(n)) {
      componentCount++;
      const name = componentDisplayName(n);
      if (!subSeen.has(name)) {
        subSeen.add(name);
        subs.push(name);
      }
      // Check if this child component contains its own components → it's a molecule, making us an organism.
      // Uses cache so the subtree is scanned at most once.
      if (!containsMolecules && hasNestedComponents(n)) {
        containsMolecules = true;
      }
      return; // don't recurse into component children for counting (they're separate units)
    }

    if (n.children) {
      for (const child of n.children) walk(child, depth + 1);
    }
  }

  if (root.children) {
    for (const child of root.children) walk(child, 1);
  }

  // Fallback: collect significant frame children if no components found
  if (subs.length === 0 && root.children) {
    for (const child of root.children) {
      if (child.visible === false) continue;
      if (isSignificantFrame(child) && !subSeen.has(child.name)) {
        subSeen.add(child.name);
        subs.push(child.name);
      }
    }
  }

  return { componentCount, containsMolecules, maxFrameDepth, subComponents: subs };
}

function classifyAtomicLevel(node: SerializedNode, data: AtomicData): AtomicLevel {
  const isSelfComponent = !!(node.isComponent || node.isInstance);

  if (data.componentCount === 0) {
    return isSelfComponent ? "atom" : "unclassified";
  }

  // Contains child components that themselves contain components → organism
  if (data.containsMolecules) return "organism";

  // Contains only atoms (leaf components) → molecule
  return "molecule";
}

export function detectAtomicLevel(node: SerializedNode): AtomicLevel {
  const data = collectAtomicData(node);
  return classifyAtomicLevel(node, data);
}

// Is this a significant structural frame? (has children, not a leaf shape/text)
function isSignificantFrame(n: SerializedNode): boolean {
  if (n.visible === false) return false;
  const isFrame = n.type === "FRAME" || n.type === "COMPONENT" || n.type === "COMPONENT_SET" || n.type === "GROUP";
  return isFrame && !!n.children && n.children.filter((c) => c.visible !== false).length > 0;
}

// Build a dependency tree showing components, instances, OR significant structural frames
function buildDependencyTree(node: SerializedNode, seen = new Set<string>()): DependencyNode | null {
  const name = componentDisplayName(node);
  const level = detectAtomicLevel(node);

  // Step 1: Try to find component/instance children
  const directComponents: SerializedNode[] = [];
  function findDirectComponents(n: SerializedNode) {
    if (n === node) {
      if (n.children) {
        for (const child of n.children) findDirectComponents(child);
      }
      return;
    }
    if (isComponentNode(n)) {
      directComponents.push(n);
      return;
    }
    if (n.children) {
      for (const child of n.children) findDirectComponents(child);
    }
  }
  findDirectComponents(node);

  // Step 2: If no components found, use significant structural frames as children
  let significantChildren: SerializedNode[];
  if (directComponents.length > 0) {
    significantChildren = directComponents;
  } else {
    significantChildren = (node.children ?? []).filter(
      (c) => c.visible !== false && isSignificantFrame(c),
    );
  }

  // Deduplicate by name
  const uniqueChildren = new Map<string, SerializedNode>();
  for (const child of significantChildren) {
    const childName = componentDisplayName(child);
    if (!uniqueChildren.has(childName)) {
      uniqueChildren.set(childName, child);
    }
  }

  // Recursively build children (with cycle protection)
  const children: DependencyNode[] = [];
  for (const [childName, child] of uniqueChildren) {
    if (seen.has(childName)) continue;
    seen.add(childName);
    const childTree = buildDependencyTree(child, seen);
    if (childTree) {
      children.push(childTree);
    }
    seen.delete(childName);
  }

  return { name, level, nodeId: node.id, children };
}

export function analyzeAtomic(node: SerializedNode): AtomicInfo {
  const data = collectAtomicData(node);
  const isComponentized = data.componentCount > 0;
  const level = classifyAtomicLevel(node, data);
  const directChildren = node.children?.filter((c) => c.visible !== false).length ?? 0;

  // Significant frames: direct frame children with their own children (when not componentized)
  const significantFrames = !isComponentized && node.children
    ? node.children
        .filter((c) => c.visible !== false && isSignificantFrame(c))
        .map((c) => c.name)
    : [];

  // Build tree for anything non-trivial
  const hasStructure = isComponentized || significantFrames.length > 0;
  const dependencyTree = hasStructure ? buildDependencyTree(node) : null;

  return {
    name: node.componentName ?? node.name,
    nodeId: node.id,
    level,
    isComponentized,
    componentCount: data.componentCount,
    instanceCount: isComponentized ? data.componentCount : directChildren,
    depth: data.maxFrameDepth,
    subComponents: data.subComponents,
    significantFrames,
    dependencyTree,
    variantProperties: node.variantProperties,
  };
}

// Flatten dependency tree into unique components with their direct children
function flattenDependencies(tree: DependencyNode): Array<{ name: string; level: AtomicLevel; deps: string[]; nodeId?: string }> {
  const result: Array<{ name: string; level: AtomicLevel; deps: string[]; nodeId?: string }> = [];
  const seen = new Set<string>();

  function walk(node: DependencyNode) {
    if (seen.has(node.name)) return;
    for (const child of node.children) {
      walk(child);
    }
    seen.add(node.name);
    result.push({
      name: node.name,
      level: node.level,
      deps: node.children.map((c) => c.name),
      nodeId: node.nodeId,
    });
  }

  walk(tree);
  return result;
}

// Build an export plan for a set of components (sorted: atoms first, from dependency tree)
export function buildExportPlan(components: AtomicInfo[]): ExportPlanItem[] {
  const levelOrder: Record<AtomicLevel, number> = { unclassified: 0, atom: 1, molecule: 2, organism: 3 };

  // Collect all unique components from dependency trees
  const allComponents: Array<{ name: string; level: AtomicLevel; deps: string[]; nodeId?: string }> = [];
  const seen = new Set<string>();

  for (const comp of components) {
    if (comp.dependencyTree) {
      for (const item of flattenDependencies(comp.dependencyTree)) {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          allComponents.push(item);
        }
      }
    } else if (!seen.has(comp.name)) {
      seen.add(comp.name);
      allComponents.push({ name: comp.name, level: comp.level, deps: comp.subComponents, nodeId: comp.nodeId });
    }
  }

  // Sort: atoms → molecules → organisms, skip unclassified (not buildable)
  const buildable = allComponents.filter((c) => c.level !== "unclassified");
  buildable.sort((a, b) => {
    const diff = levelOrder[a.level] - levelOrder[b.level];
    if (diff !== 0) return diff;
    // Fewer deps first (simpler first)
    return a.deps.length - b.deps.length;
  });

  // Build plan with context
  const built = new Set<string>();

  return buildable.map((comp, i) => {
    const knownDeps = comp.deps.filter((d) => built.has(d));
    const context = knownDeps.length > 0
      ? `uses: ${knownDeps.map((s) => `<${s}>`).join(", ")}`
      : "no dependencies";

    built.add(comp.name);

    return {
      step: i + 1,
      name: comp.name,
      level: comp.level,
      context,
      nodeId: comp.nodeId,
    };
  });
}
