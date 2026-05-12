import type { SerializedNode, SerializedPaint, SerializedLayoutGrid, SerializedPropertyDef } from "../shared/types";

const MAX_DEPTH = 15;

function styleToWeight(style: string): number {
  const s = style.toLowerCase();
  if (s.includes("thin") || s.includes("hairline")) return 100;
  if (s.includes("extralight") || s.includes("ultra light")) return 200;
  if (s.includes("light")) return 300;
  if (s.includes("medium")) return 500;
  if (s.includes("semibold") || s.includes("demi bold")) return 600;
  if (s.includes("extrabold") || s.includes("ultra bold")) return 800;
  if (s.includes("black") || s.includes("heavy")) return 900;
  if (s.includes("bold")) return 700;
  return 400; // Regular/Normal
}

// figma.mixed is a Symbol — cannot be serialized via postMessage
function isMixed(value: unknown): boolean {
  return typeof value === "symbol";
}

function serializePaint(paint: Paint): SerializedPaint | null {
  if (!paint.visible) return null;
  const result: SerializedPaint = { type: paint.type };
  if (paint.type === "SOLID") {
    const s = paint as SolidPaint;
    result.color = {
      r: Math.round(s.color.r * 255),
      g: Math.round(s.color.g * 255),
      b: Math.round(s.color.b * 255),
    };
    if (s.opacity !== undefined && s.opacity !== 1) {
      result.opacity = Math.round(s.opacity * 100) / 100;
    }
  } else if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL") {
    const g = paint as GradientPaint;
    result.gradientStops = g.gradientStops.map((s) => ({
      color: {
        r: Math.round(s.color.r * 255),
        g: Math.round(s.color.g * 255),
        b: Math.round(s.color.b * 255),
        a: Math.round((s.color.a ?? 1) * 100) / 100,
      },
      position: Math.round(s.position * 100) / 100,
    }));
    if (paint.type === "GRADIENT_LINEAR") {
      const t = g.gradientTransform;
      result.gradientAngle = Math.round(Math.atan2(t[0][1], t[0][0]) * (180 / Math.PI));
    }
  }
  return result;
}

function serializeLayoutGrid(grid: LayoutGrid): SerializedLayoutGrid {
  const result: SerializedLayoutGrid = {
    pattern: grid.pattern,
  };
  if (grid.pattern === "COLUMNS" || grid.pattern === "ROWS") {
    const g = grid as RowsColsLayoutGrid;
    result.count = g.count;
    result.gutterSize = g.gutterSize;
    result.alignment = g.alignment;
    result.offset = g.offset;
    result.sectionSize = g.sectionSize;
  }
  return result;
}

export async function serializeNode(node: SceneNode, depth = 0): Promise<SerializedNode> {
  const result: SerializedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if ("visible" in node) result.visible = node.visible;
  if ("width" in node) {
    result.width = Math.round(node.width);
    result.height = Math.round(node.height);
  }
  if (depth > 0 && "x" in node) {
    result.x = Math.round(node.x);
    result.y = Math.round(node.y);
  }

  // Auto Layout
  if ("layoutMode" in node && (node as FrameNode).layoutMode !== "NONE") {
    const f = node as FrameNode;
    result.layoutMode = f.layoutMode as "HORIZONTAL" | "VERTICAL";
    result.layoutSizingHorizontal = f.layoutSizingHorizontal;
    result.layoutSizingVertical = f.layoutSizingVertical;
    if (!isMixed(f.itemSpacing)) result.itemSpacing = f.itemSpacing;
    if (!isMixed(f.paddingTop)) result.paddingTop = f.paddingTop;
    if (!isMixed(f.paddingRight)) result.paddingRight = f.paddingRight;
    if (!isMixed(f.paddingBottom)) result.paddingBottom = f.paddingBottom;
    if (!isMixed(f.paddingLeft)) result.paddingLeft = f.paddingLeft;
  }

  // Min/Max constraints (auto-layout frames and their children)
  if ("minWidth" in node) {
    const f = node as FrameNode;
    if (f.minWidth !== null && f.minWidth > 0) result.minWidth = f.minWidth;
    if (f.maxWidth !== null && f.maxWidth < Infinity) result.maxWidth = f.maxWidth;
    if (f.minHeight !== null && f.minHeight > 0) result.minHeight = f.minHeight;
    if (f.maxHeight !== null && f.maxHeight < Infinity) result.maxHeight = f.maxHeight;
  }

  // Overflow clipping
  if ("clipsContent" in node && (node as FrameNode).clipsContent) {
    result.clipsContent = true;
  }

  // Layout Grids
  if ("layoutGrids" in node) {
    const grids = (node as FrameNode).layoutGrids;
    if (grids && !isMixed(grids) && grids.length > 0) {
      result.layoutGrids = grids.map(serializeLayoutGrid);
    }
  }

  // Visual properties
  if ("opacity" in node && !isMixed(node.opacity) && node.opacity !== 1) {
    result.opacity = Math.round(node.opacity * 100) / 100;
  }
  if ("fills" in node && !isMixed(node.fills)) {
    const rawFills = node.fills as Paint[];
    const fills = rawFills
      .map((paint, i) => {
        const sp = serializePaint(paint);
        if (!sp) return null;
        // Check if this fill is bound to a Figma variable
        try {
          const bv = (node as GeometryMixin & { boundVariables?: { fills?: { id: string }[]; strokes?: { id: string }[] } }).boundVariables?.fills;
          if (bv && bv[i]) {
            sp.boundToVariable = true;
            // Read variable name
            try {
              const variable = figma.variables.getVariableById(bv[i].id);
              if (variable) sp.variableName = variable.name;
            } catch { /* variable not accessible */ }
          }
        } catch {
          /* some nodes don't support boundVariables */
        }
        return sp;
      })
      .filter(Boolean) as SerializedPaint[];
    if (fills.length) result.fills = fills;
  }
  if ("strokes" in node && !isMixed(node.strokes)) {
    const strokes = (node.strokes as Paint[])
      .map((paint, i) => {
        const sp = serializePaint(paint);
        if (!sp) return null;
        try {
          const bv = (node as GeometryMixin & { boundVariables?: { fills?: { id: string }[]; strokes?: { id: string }[] } }).boundVariables?.strokes;
          if (bv && bv[i]) {
            sp.boundToVariable = true;
            try {
              const variable = figma.variables.getVariableById(bv[i].id);
              if (variable) sp.variableName = variable.name;
            } catch { /* variable not accessible */ }
          }
        } catch {
          /* some nodes don't support boundVariables */
        }
        return sp;
      })
      .filter(Boolean) as SerializedPaint[];
    if (strokes.length) result.strokes = strokes;
  }
  // Stroke metadata
  if ("strokeWeight" in node && !isMixed((node as GeometryMixin).strokeWeight)) {
    const sw = (node as GeometryMixin).strokeWeight as number;
    if (sw > 0) result.strokeWeight = sw;
  }
  if ("strokeAlign" in node) {
    result.strokeAlign = (node as GeometryMixin).strokeAlign as "CENTER" | "INSIDE" | "OUTSIDE";
  }
  // Constraints (responsive sizing hints)
  if ("constraints" in node && depth > 0) {
    const c = (node as FrameNode).constraints;
    if (c && (c.horizontal !== "MIN" || c.vertical !== "MIN")) {
      result.constraints = { horizontal: c.horizontal, vertical: c.vertical };
    }
  }

  // Effects (shadows, blur)
  if ("effects" in node) {
    const effects = (node as FrameNode).effects;
    if (effects && !isMixed(effects) && effects.length > 0) {
      const serialized = effects
        .filter((e) => e.visible)
        .map((e) => {
          const se: import("../shared/types").SerializedEffect = { type: e.type as import("../shared/types").SerializedEffect["type"] };
          if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
            const shadow = e as DropShadowEffect;
            se.color = {
              r: Math.round(shadow.color.r * 255),
              g: Math.round(shadow.color.g * 255),
              b: Math.round(shadow.color.b * 255),
              a: Math.round((shadow.color.a ?? 1) * 100) / 100,
            };
            se.offset = { x: Math.round(shadow.offset.x), y: Math.round(shadow.offset.y) };
            se.radius = Math.round(shadow.radius);
            if ("spread" in shadow) se.spread = Math.round(shadow.spread as number);
          } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
            se.radius = Math.round((e as BlurEffect).radius);
          }
          return se;
        });
      if (serialized.length > 0) result.effects = serialized;
    }
  }

  if ("cornerRadius" in node && !isMixed((node as RectangleNode).cornerRadius)) {
    result.cornerRadius = (node as RectangleNode).cornerRadius as number;
  }

  // Text
  if (node.type === "TEXT") {
    const t = node as TextNode;
    result.characters = t.characters;
    if (!isMixed(t.fontSize)) result.fontSize = t.fontSize as number;
    if (!isMixed(t.fontName)) {
      const fn = t.fontName as { family: string; style: string };
      result.fontName = fn;
      result.fontWeight = styleToWeight(fn.style);
    }
    if (!isMixed(t.lineHeight)) {
      const lh = t.lineHeight as LineHeight;
      if (lh.unit === "PIXELS") result.lineHeight = lh.value;
      else if (lh.unit === "PERCENT") result.lineHeight = `${Math.round(lh.value)}%`;
      // AUTO → omit (browser default)
    }
    if (!isMixed(t.letterSpacing)) {
      const ls = t.letterSpacing as LetterSpacing;
      if (ls.unit === "PIXELS" && ls.value !== 0) result.letterSpacing = Math.round(ls.value * 100) / 100;
      else if (ls.unit === "PERCENT" && ls.value !== 0) result.letterSpacing = Math.round(ls.value * 100) / 100;
    }
    if (!isMixed(t.textAlignHorizontal)) {
      result.textAlignHorizontal = t.textAlignHorizontal;
    }
    if (!isMixed(t.textDecoration)) {
      const dec = t.textDecoration as string;
      if (dec !== "NONE") result.textDecoration = dec;
    }
    if (!isMixed(t.textCase)) {
      const tc = t.textCase as string;
      if (tc !== "ORIGINAL") result.textCase = tc;
    }
    // Text truncation / auto-resize
    if ("textAutoResize" in t) {
      result.textAutoResize = t.textAutoResize as string;
    }
    if ("textTruncation" in t) {
      const tt = t.textTruncation as string;
      if (tt !== "DISABLED") result.textTruncation = tt;
    }
    if ("maxLines" in t && t.maxLines !== null) {
      result.maxLines = t.maxLines as number;
    }
  }

  // Components
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    result.isComponent = true;
    const desc = (node as ComponentNode).description;
    if (desc && desc.trim()) {
      result.componentDescription = desc.trim();
    }

    // For COMPONENT inside a ComponentSet, use the parent's clean name
    if (node.type === "COMPONENT" && node.parent?.type === "COMPONENT_SET") {
      result.componentName = node.parent.name;
      const variantProps = (node as ComponentNode).variantProperties;
      if (variantProps && Object.keys(variantProps).length > 0) {
        result.variantProperties = variantProps;
      }
    }

    if (node.type === "COMPONENT_SET") {
      const cs = node as ComponentSetNode;
      const propDefs = cs.componentPropertyDefinitions;
      if (propDefs) {
        result.componentPropertyDefinitions = Object.entries(propDefs)
          .map(([name, def]) => {
            const d: SerializedPropertyDef = {
              name,
              type: def.type as SerializedPropertyDef["type"],
            };
            if ("variantOptions" in def && def.variantOptions) {
              d.values = def.variantOptions as string[];
            }
            if ("defaultValue" in def && !isMixed(def.defaultValue)) {
              d.defaultValue = def.defaultValue as string | boolean;
            }
            return d;
          });
      }
    }
  }
  if (node.type === "INSTANCE") {
    result.isInstance = true;
    const inst = node as InstanceNode;
    // Use ComponentSet name (clean) instead of variant Component name ("Property 1=value, ...")
    let mainComp: ComponentNode | null = null;
    try {
      mainComp = await inst.getMainComponentAsync();
    } catch { /* main component unavailable (external library, no access) */ }
    if (mainComp?.parent?.type === "COMPONENT_SET") {
      result.componentName = mainComp.parent.name;
      const setDesc = (mainComp.parent as ComponentSetNode).description;
      if (setDesc && setDesc.trim()) result.componentDescription = setDesc.trim();
    } else if (mainComp) {
      result.componentName = mainComp.name;
      if (mainComp.description?.trim()) result.componentDescription = mainComp.description.trim();
    }
    const variantProps = inst.variantProperties;
    if (variantProps && Object.keys(variantProps).length > 0) {
      result.variantProperties = variantProps;
    }

    // Serialize all property definitions (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP)
    const parentSet = mainComp?.parent?.type === "COMPONENT_SET" ? mainComp.parent as ComponentSetNode : null;
    if (parentSet) {
      const propDefs = parentSet.componentPropertyDefinitions;
      if (propDefs) {
        const available: Record<string, string[]> = {};
        const allDefs: SerializedPropertyDef[] = [];
        for (const [name, def] of Object.entries(propDefs)) {
          allDefs.push({
            name,
            type: def.type as SerializedPropertyDef["type"],
            values: "variantOptions" in def && def.variantOptions ? def.variantOptions as string[] : undefined,
            defaultValue: "defaultValue" in def && !isMixed(def.defaultValue) ? def.defaultValue as string | boolean : undefined,
          });
          if (def.type === "VARIANT" && "variantOptions" in def && def.variantOptions) {
            available[name] = def.variantOptions as string[];
          }
        }
        if (Object.keys(available).length > 0) {
          result.availableVariants = available;
        }
        if (allDefs.length > 0) {
          result.componentPropertyDefinitions = allDefs;
        }
      }
    }

    // Serialize current component property values (Boolean, Text props)
    try {
      const compProps = inst.componentProperties;
      if (compProps && Object.keys(compProps).length > 0) {
        const props: Record<string, { type: string; value: string | boolean }> = {};
        for (const [name, prop] of Object.entries(compProps)) {
          props[name] = { type: prop.type, value: prop.value as string | boolean };
        }
        result.componentProperties = props;
      }
    } catch { /* componentProperties not available on all instances */ }
  }

  // Children — catch per child so one broken node doesn't block the parent
  if ("children" in node && depth < MAX_DEPTH) {
    result.children = (await Promise.all(
      (node as FrameNode).children.map((c) =>
        serializeNode(c, depth + 1).catch(() => ({
          id: c.id,
          name: c.name,
          type: c.type,
          width: "width" in c ? Math.round(c.width as number) : 0,
          height: "height" in c ? Math.round(c.height as number) : 0,
        } as SerializedNode))
      )
    ));
  }

  return result;
}
