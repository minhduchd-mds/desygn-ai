import type { PluginMessage } from "../../shared/types";
import type {
  DesignSystemComponentInfo,
  DesignSystemPageInfo,
  DesignSystemSnapshot,
  DesignSystemSyncDiagnostics,
  DesignSystemVariableInfo,
  FigmaImportSource,
} from "../../shared/types";

function normalizeTokenName(name: string): string {
  return name.replace(/\//g, "-").toLowerCase();
}

function colorToHex(color: { r: number; g: number; b: number }): string {
  return `#${Math.round(color.r * 255).toString(16).padStart(2, "0")}${Math.round(color.g * 255).toString(16).padStart(2, "0")}${Math.round(color.b * 255).toString(16).padStart(2, "0")}`;
}

function isColorValue(value: unknown): value is { r: number; g: number; b: number; a: number } {
  return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
}

function isVariableAlias(value: unknown): value is { type: "VARIABLE_ALIAS"; id: string } {
  return typeof value === "object" && value !== null && "type" in value && (value as { type?: string }).type === "VARIABLE_ALIAS" && "id" in value;
}

async function resolveColorVariableValue(
  value: unknown,
  modeIdByCollectionId: Map<string, string>,
  seen = new Set<string>(),
): Promise<string | null> {
  if (isColorValue(value)) {
    return colorToHex(value);
  }

  if (!isVariableAlias(value) || seen.has(value.id)) {
    return null;
  }

  seen.add(value.id);
  const target = await figma.variables.getVariableByIdAsync(value.id);
  if (!target) return null;
  const targetModeId = modeIdByCollectionId.get(target.variableCollectionId);
  if (!targetModeId) return null;
  return resolveColorVariableValue(target.valuesByMode[targetModeId], modeIdByCollectionId, seen);
}

async function readAllLocalColorVariables(): Promise<Record<string, string>> {
  const tokens: Record<string, string> = {};
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const modeIdByCollectionId = new Map<string, string>();

  for (const coll of collections) {
    const preferredMode =
      coll.modes.find((mode) => mode.name.toLowerCase() === "light") ??
      coll.modes.find((mode) => /default|base/i.test(mode.name)) ??
      coll.modes[0];
    if (preferredMode) {
      modeIdByCollectionId.set(coll.id, preferredMode.modeId);
    }
  }

  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  for (const variable of variables) {
    const modeId = modeIdByCollectionId.get(variable.variableCollectionId);
    if (!modeId) continue;
    const hex = await resolveColorVariableValue(variable.valuesByMode[modeId], modeIdByCollectionId);
    if (hex) {
      tokens[normalizeTokenName(variable.name)] = hex;
    }
  }

  return tokens;
}

function variableValueToString(value: unknown, resolvedType: VariableResolvedDataType): string | null {
  if (resolvedType === "COLOR" && isColorValue(value)) {
    return colorToHex(value);
  }
  if (resolvedType === "FLOAT" && typeof value === "number") {
    return `${value}`;
  }
  if (resolvedType === "STRING" && typeof value === "string") {
    return value;
  }
  if (resolvedType === "BOOLEAN" && typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (isVariableAlias(value)) {
    return `alias:${value.id}`;
  }
  return null;
}

async function readDesignSystemVariables(): Promise<DesignSystemVariableInfo[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));
  const variables = await figma.variables.getLocalVariablesAsync();
  const result: DesignSystemVariableInfo[] = [];

  for (const variable of variables) {
    const collection = collectionById.get(variable.variableCollectionId);
    if (!collection) continue;
    const preferredMode =
      collection.modes.find((mode) => mode.name.toLowerCase() === "light") ??
      collection.modes.find((mode) => /default|base/i.test(mode.name)) ??
      collection.modes[0];
    if (!preferredMode) continue;
    const rawValue = variable.valuesByMode[preferredMode.modeId];
    const value = variableValueToString(rawValue, variable.resolvedType);
    if (value === null) continue;

    result.push({
      id: variable.id,
      name: variable.name,
      collectionName: collection.name,
      modeName: preferredMode.name,
      resolvedType: variable.resolvedType,
      value,
    });
  }

  return result.sort((a, b) => `${a.collectionName}/${a.name}`.localeCompare(`${b.collectionName}/${b.name}`));
}

function getNodePageName(node: BaseNode): string {
  let parent = node.parent;
  while (parent) {
    if (parent.type === "PAGE") return parent.name;
    parent = parent.parent;
  }
  return figma.currentPage.name;
}

function createDiagnostics(): DesignSystemSyncDiagnostics {
  return {
    localRegistryComponents: 0,
    localRegistryComponentSets: 0,
    libraryComponents: 0,
    libraryComponentSets: 0,
    documentComponents: 0,
    documentComponentSets: 0,
    instances: 0,
    resolvedInstanceComponents: 0,
    errors: [],
  };
}

function inferComponentRole(name: string): DesignSystemComponentInfo["role"] {
  const value = name.toLowerCase();
  if (/nav|menu|sidebar|breadcrumb|tab|header|topbar/.test(value)) return "navigation";
  if (/kpi|metric|stat|summary/.test(value)) return "kpi";
  if (/chart|graph|plot|analytics/.test(value)) return "chart";
  if (/table|row|cell|pagination|grid/.test(value)) return "table";
  if (/form|field|input|select|checkbox|radio|switch|textarea|search|filter/.test(value)) return "form";
  if (/modal|dialog|drawer|popover|toast|alert/.test(value)) return "modal";
  if (/card|tile|panel/.test(value)) return "card";
  if (/list|item|feed|activity|notification/.test(value)) return "list";
  if (/button|cta|action|toolbar/.test(value)) return "action";
  if (/hero|footer|content|section|article|text/.test(value)) return "content";
  return "unknown";
}

async function readAllFileComponents(diagnostics: DesignSystemSyncDiagnostics): Promise<DesignSystemComponentInfo[]> {
  await figma.loadAllPagesAsync();
  figma.skipInvisibleInstanceChildren = true;

  const results = new Map<string, DesignSystemComponentInfo>();

  function addComponentNode(node: ComponentNode | ComponentSetNode, pageName = getNodePageName(node), source: DesignSystemComponentInfo["source"] = "local") {
    const componentSet = node.type === "COMPONENT_SET" ? node : node.parent?.type === "COMPONENT_SET" ? node.parent : null;
    const sourceNode = componentSet ?? node;
    const key = sourceNode.key || sourceNode.id;
    if (results.has(key)) return;

    const info: DesignSystemComponentInfo = {
      id: sourceNode.id,
      nodeId: sourceNode.id,
      componentKey: sourceNode.key || undefined,
      name: sourceNode.name,
      type: sourceNode.type,
      pageName: getNodePageName(sourceNode) || pageName,
      source,
      role: inferComponentRole(sourceNode.name),
    };

    if ("description" in sourceNode && sourceNode.description?.trim()) {
      info.description = sourceNode.description.trim();
    }

    if (componentSet) {
      const definitions = componentSet.componentPropertyDefinitions;
      const variantProperties: Record<string, string[]> = {};
      for (const [name, def] of Object.entries(definitions)) {
        if (def.type === "VARIANT" && "variantOptions" in def && def.variantOptions) {
          variantProperties[name] = [...def.variantOptions];
        }
      }
      if (Object.keys(variantProperties).length > 0) {
        info.variantProperties = variantProperties;
      }
    }

    results.set(key, info);
  }

  type FigmaWithComponentRegistries = typeof figma & {
    getLocalComponentsAsync?: () => Promise<ComponentNode[]>;
    getLocalComponentSetsAsync?: () => Promise<ComponentSetNode[]>;
    teamLibrary?: typeof figma.teamLibrary & {
      getAvailableComponentsAsync?: () => Promise<Array<{ key: string; name: string; description?: string; libraryName?: string }>>;
      getAvailableComponentSetsAsync?: () => Promise<Array<{ key: string; name: string; description?: string; libraryName?: string }>>;
    };
  };
  const figmaWithRegistries = figma as FigmaWithComponentRegistries;

  try {
    const localComponents = await figmaWithRegistries.getLocalComponentsAsync?.();
    diagnostics.localRegistryComponents = localComponents?.length ?? 0;
    for (const node of localComponents ?? []) {
      addComponentNode(node);
    }
  } catch (e) {
    diagnostics.errors.push(`local components registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read local component registry:", e);
  }

  try {
    const localComponentSets = await figmaWithRegistries.getLocalComponentSetsAsync?.();
    diagnostics.localRegistryComponentSets = localComponentSets?.length ?? 0;
    for (const node of localComponentSets ?? []) {
      addComponentNode(node);
    }
  } catch (e) {
    diagnostics.errors.push(`local component set registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read local component set registry:", e);
  }

  try {
    const libraryComponents = await figmaWithRegistries.teamLibrary?.getAvailableComponentsAsync?.();
    diagnostics.libraryComponents = libraryComponents?.length ?? 0;
    for (const component of libraryComponents ?? []) {
      results.set(`library-component:${component.key}`, {
        id: component.key,
        componentKey: component.key,
        name: component.name,
        type: "COMPONENT",
        pageName: component.libraryName ? `Library: ${component.libraryName}` : "Library",
        source: "library",
        role: inferComponentRole(component.name),
        description: component.description,
      });
    }
  } catch (e) {
    diagnostics.errors.push(`library components registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read available library components:", e);
  }

  try {
    const libraryComponentSets = await figmaWithRegistries.teamLibrary?.getAvailableComponentSetsAsync?.();
    diagnostics.libraryComponentSets = libraryComponentSets?.length ?? 0;
    for (const componentSet of libraryComponentSets ?? []) {
      results.set(`library-component-set:${componentSet.key}`, {
        id: componentSet.key,
        componentKey: componentSet.key,
        name: componentSet.name,
        type: "COMPONENT_SET",
        pageName: componentSet.libraryName ? `Library: ${componentSet.libraryName}` : "Library",
        source: "library",
        role: inferComponentRole(componentSet.name),
        description: componentSet.description,
      });
    }
  } catch (e) {
    diagnostics.errors.push(`library component sets registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read available library component sets:", e);
  }

  const allInstances: InstanceNode[] = [];
  for (const page of figma.root.children) {
    try {
      await page.loadAsync();
      const pageComponents = page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
      for (const node of pageComponents) {
        if (node.type === "COMPONENT") diagnostics.documentComponents++;
        if (node.type === "COMPONENT_SET") diagnostics.documentComponentSets++;
        addComponentNode(node, page.name, "document");
      }
      allInstances.push(...page.findAllWithCriteria({ types: ["INSTANCE"] }));
    } catch (e) {
      diagnostics.errors.push(`page "${page.name}": ${e instanceof Error ? e.message : String(e)}`);
      console.warn(`Could not scan page "${page.name}":`, e);
    }
  }

  diagnostics.instances = allInstances.length;
  for (const instance of allInstances) {
    try {
      const mainComponent = await instance.getMainComponentAsync();
      if (mainComponent) {
        diagnostics.resolvedInstanceComponents++;
        addComponentNode(mainComponent, getNodePageName(instance), "instance");
      } else if ((instance as InstanceNode & { componentName?: string }).componentName) {
        const cName = (instance as InstanceNode & { componentName?: string }).componentName!;
        results.set(`instance:${cName}:${getNodePageName(instance)}`, {
          id: instance.id,
          nodeId: instance.id,
          name: cName,
          type: "COMPONENT",
          pageName: getNodePageName(instance),
          source: "instance",
          role: inferComponentRole(cName),
        });
      }
    } catch {
      if ((instance as InstanceNode & { componentName?: string }).componentName) {
        const cName = (instance as InstanceNode & { componentName?: string }).componentName!;
        results.set(`instance:${cName}:${getNodePageName(instance)}`, {
          id: instance.id,
          nodeId: instance.id,
          name: cName,
          type: "COMPONENT",
          pageName: getNodePageName(instance),
          source: "instance",
          role: inferComponentRole(cName),
        });
      }
    }
  }

  return Array.from(results.values()).sort((a, b) => `${a.pageName}/${a.name}`.localeCompare(`${b.pageName}/${b.name}`));
}

function summarizeAllPages(components: DesignSystemComponentInfo[]): DesignSystemPageInfo[] {
  const componentCountByPage = components.reduce((counts, component) => {
    counts.set(component.pageName, (counts.get(component.pageName) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return figma.root.children
    .map((page) => ({
      id: page.id,
      name: page.name,
      componentCount: componentCountByPage.get(page.name) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendDesignSystemSnapshot(): Promise<void> {
  let variables: DesignSystemVariableInfo[] = [];
  let components: DesignSystemComponentInfo[] = [];
  const diagnostics = createDiagnostics();

  try {
    variables = await readDesignSystemVariables();
  } catch (e) {
    console.warn("Could not read design system variables:", e);
  }

  try {
    components = await readAllFileComponents(diagnostics);
  } catch (e) {
    diagnostics.errors.push(`component sync: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read design system components:", e);
  }

  const snapshot: DesignSystemSnapshot = {
    fileName: figma.root.name,
    pageName: components.length > 0 ? "All pages" : figma.currentPage.name,
    pages: summarizeAllPages(components),
    components,
    variables,
    diagnostics,
  };

  figma.ui.postMessage({ type: "design-system-snapshot-result", snapshot } satisfies PluginMessage);
}

export async function importFigmaColorVariables(): Promise<void> {
  try {
    const tokens = await readAllLocalColorVariables();
    const msg: PluginMessage = {
      type: "figma-color-variables-result",
      tokens,
      fileName: figma.root.name,
      count: Object.keys(tokens).length,
    };
    figma.ui.postMessage(msg);
  } catch (e) {
    console.warn("Could not read color variables:", e);
    figma.ui.postMessage({ type: "figma-color-variables-result", tokens: {}, fileName: figma.root.name, count: 0 });
  }
}

export async function discoverFigmaSources(): Promise<void> {
  const sources: FigmaImportSource[] = [];

  // Local variables — grouped by collection
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();

    const collStats = new Map<string, { colors: number; floats: number; strings: number }>();
    for (const coll of collections) {
      collStats.set(coll.id, { colors: 0, floats: 0, strings: 0 });
    }
    for (const v of variables) {
      const c = collStats.get(v.variableCollectionId);
      if (!c) continue;
      if (v.resolvedType === "COLOR") c.colors++;
      else if (v.resolvedType === "FLOAT") c.floats++;
      else if (v.resolvedType === "STRING") c.strings++;
    }

    for (const coll of collections) {
      const c = collStats.get(coll.id)!;
      const total = c.colors + c.floats + c.strings;
      if (total === 0) continue;
      const parts: string[] = [];
      if (c.colors > 0) parts.push(`${c.colors} colors`);
      if (c.floats > 0) parts.push(`${c.floats} numbers`);
      if (c.strings > 0) parts.push(`${c.strings} strings`);
      sources.push({ id: `vars:${coll.id}`, name: coll.name, type: "local-variables", count: total, detail: parts.join(", ") });
    }
  } catch (e) {
    console.warn("Could not read variables:", e);
  }

  // Local paint styles
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    if (paintStyles.length > 0) {
      sources.push({ id: "styles:paint", name: "Color Styles", type: "local-styles", count: paintStyles.length, detail: `${paintStyles.length} paint styles` });
    }
  } catch (e) {
    console.warn("Could not read paint styles:", e);
  }

  // Local components — always offer, skip expensive scan (count happens on import)
  sources.push({ id: "local:components", name: "Local Components", type: "local-components", count: 0, detail: "Components in this file" });

  // Team library — skip entirely during discovery (often hangs)
  // Users can still import local variables, styles, and components

  const msg: PluginMessage = { type: "figma-sources-result", sources };
  figma.ui.postMessage(msg);
}

export async function importFigmaTokens(sourceIds: string[]): Promise<void> {
  const tokens: Record<string, string> = {};
  const componentNames: string[] = [];
  const selectedSet = new Set(sourceIds);

  // Import variable collections (batch)
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collModeMap = new Map<string, string>();
    for (const coll of collections) {
      if (selectedSet.has(`vars:${coll.id}`) && coll.modes.length > 0) {
        collModeMap.set(coll.id, coll.modes[0].modeId);
      }
    }

    if (collModeMap.size > 0) {
      const variables = await figma.variables.getLocalVariablesAsync();
      for (const v of variables) {
        const modeId = collModeMap.get(v.variableCollectionId);
        if (!modeId) continue;
        const value = v.valuesByMode[modeId];
        if (value === undefined) continue;
        const name = normalizeTokenName(v.name);

        if (v.resolvedType === "COLOR" && isColorValue(value)) {
          const hex = colorToHex(value);
          tokens[name] = hex;
        } else if (v.resolvedType === "FLOAT" && typeof value === "number") {
          tokens[name] = `${value}px`;
        } else if (v.resolvedType === "STRING" && typeof value === "string") {
          tokens[name] = value;
        }
      }
    }
  } catch (e) {
    console.warn("Could not read variables:", e);
  }

  // Import paint styles
  if (selectedSet.has("styles:paint")) {
    try {
      const paintStyles = await figma.getLocalPaintStylesAsync();
      for (const style of paintStyles) {
        if (style.paints.length > 0 && style.paints[0].type === "SOLID") {
          const paint = style.paints[0] as SolidPaint;
          const name = normalizeTokenName(style.name);
          const hex = colorToHex(paint.color);
          tokens[name] = hex;
        }
      }
    } catch (e) {
      console.warn("Could not read paint styles:", e);
    }
  }

  // Import local components across the whole file.
  if (selectedSet.has("local:components")) {
    try {
      const seen = new Set<string>();
      const components = await readAllFileComponents(createDiagnostics());
      for (const comp of components) {
        const key = `${comp.pageName}/${comp.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          componentNames.push(comp.name);
        }
      }
    } catch (e) {
      console.warn("Could not read components:", e);
    }
  }

  const fileName = figma.root.name;
  const msg: PluginMessage = { type: "figma-tokens-result", tokens, components: componentNames, fileName };
  figma.ui.postMessage(msg);
}

export async function handleFigmaImportMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "get-figma-sources":
      try {
        await discoverFigmaSources();
      } catch (e) {
        console.warn("discoverFigmaSources failed:", e);
        figma.ui.postMessage({ type: "figma-sources-result", sources: [] });
      }
      return true;
    case "import-figma-tokens":
      try {
        await importFigmaTokens(msg.sourceIds);
      } catch (e) {
        console.warn("importFigmaTokens failed:", e);
        figma.ui.postMessage({ type: "figma-tokens-result", tokens: {}, components: [], fileName: figma.root.name });
      }
      return true;
    case "get-figma-color-variables":
      await importFigmaColorVariables();
      return true;
    case "get-design-system-snapshot":
      await sendDesignSystemSnapshot();
      return true;
    default:
      return false;
  }
}
