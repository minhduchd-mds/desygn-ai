import type { DesignSystemComponentInfo, FigmaProjectFrameRequest, PluginMessage } from "../../shared/types";

const FRAME_WIDTH = 1440;
const FRAME_PADDING = 48;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 160;
const CONTENT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;

// ── Color palette ──
const COLORS = {
  bg:       { r: 0.965, g: 0.973, b: 0.984 },
  white:    { r: 1, g: 1, b: 1 },
  card:     { r: 0.992, g: 0.996, b: 1 },
  border:   { r: 0.86, g: 0.89, b: 0.93 },
  borderL:  { r: 0.91, g: 0.93, b: 0.96 },
  title:    { r: 0.07, g: 0.09, b: 0.13 },
  heading:  { r: 0.09, g: 0.11, b: 0.15 },
  body:     { r: 0.33, g: 0.37, b: 0.44 },
  meta:     { r: 0.5, g: 0.54, b: 0.6 },
  tag:      { r: 0.18, g: 0.22, b: 0.28 },
  tagBg:    { r: 0.94, g: 0.96, b: 0.98 },
  tagStroke:{ r: 0.84, g: 0.87, b: 0.91 },
  accent:   { r: 0.22, g: 0.47, b: 0.97 },
  accentBg: { r: 0.93, g: 0.95, b: 1 },
  empty:    { r: 0.62, g: 0.66, b: 0.72 },
  emptyBg:  { r: 0.96, g: 0.97, b: 0.98 },
  instance: { r: 0.12, g: 0.72, b: 0.56 },
  placeholder:{ r: 0.96, g: 0.68, b: 0.2 },
};

interface FrameBuildState {
  instanceCount: number;
  placeholderCount: number;
}

// ── Font helpers ──

function normalizeFontStyle(style: string): string {
  return style.toLowerCase().replace(/\s+/g, "");
}

function fontKey(font: FontName): string {
  return `${font.family}/${font.style}`;
}

function getFontFromCurrentPage(): FontName | null {
  try {
    const textNodes = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
    for (const node of textNodes) {
      if (node.fontName !== figma.mixed) return node.fontName;
    }
  } catch { /* ignore */ }
  return null;
}

async function findAvailableFamilyStyle(baseFont: FontName | null, requestedStyle: "Regular" | "Semi Bold"): Promise<FontName | null> {
  if (!baseFont || !figma.listAvailableFontsAsync) return null;
  try {
    const availableFonts = await figma.listAvailableFontsAsync();
    const familyFonts = availableFonts.map(f => f.fontName).filter(f => f.family === baseFont.family);
    if (familyFonts.length === 0) return null;
    const preferredStyles = requestedStyle === "Semi Bold"
      ? ["semibold", "demibold", "medium", "bold", normalizeFontStyle(baseFont.style)]
      : ["regular", "book", "normal", normalizeFontStyle(baseFont.style)];
    return (
      familyFonts.find(f => preferredStyles.includes(normalizeFontStyle(f.style))) ??
      familyFonts.find(f => normalizeFontStyle(f.style) === normalizeFontStyle(baseFont.style)) ??
      familyFonts[0]
    );
  } catch { return null; }
}

async function loadPreferredFont(style: "Regular" | "Semi Bold" = "Regular"): Promise<FontName> {
  const documentFont = await findAvailableFamilyStyle(getFontFromCurrentPage(), style);
  const candidates: FontName[] = [
    ...(documentFont ? [documentFont] : []),
    { family: "Inter", style },
    { family: "Inter", style: style === "Semi Bold" ? "Medium" : "Regular" },
    { family: "Open Sauce Two", style: style === "Semi Bold" ? "SemiBold" : "Regular" },
    { family: "Open Sauce Two", style: style === "Semi Bold" ? "Medium" : "Regular" },
    { family: "Roboto", style: style === "Semi Bold" ? "Medium" : "Regular" },
  ];

  const seen = new Set<string>();
  for (const font of candidates) {
    const key = fontKey(font);
    if (seen.has(key)) continue;
    seen.add(key);
    try { await figma.loadFontAsync(font); return font; } catch { /* next */ }
  }

  const fallback = { family: "Arial", style: style === "Semi Bold" ? "Bold" : "Regular" };
  await figma.loadFontAsync(fallback);
  return fallback;
}

// ── Node helpers ──

function isSceneNode(node: BaseNode | null): node is SceneNode {
  return !!node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE";
}

function isComponentLike(node: SceneNode): node is ComponentNode | ComponentSetNode {
  return node.type === "COMPONENT" || node.type === "COMPONENT_SET";
}

function findDefaultVariant(componentSet: ComponentSetNode): ComponentNode | null {
  const components = componentSet.children.filter((c): c is ComponentNode => c.type === "COMPONENT");
  if (components.length === 0) return null;
  return (
    components.find(c => {
      const values = Object.values(c.variantProperties ?? {}).map(v => v.toLowerCase());
      return values.includes("default");
    }) ?? components[0]
  );
}

// ── Font loading for instances ──

async function loadInstanceFonts(node: SceneNode): Promise<void> {
  const loaded = new Set<string>();
  const textNodes: TextNode[] = [];

  function collect(n: SceneNode) {
    if (n.type === "TEXT") {
      textNodes.push(n);
    } else if ("children" in n) {
      for (const child of (n as ChildrenMixin).children) {
        if (isSceneNode(child)) collect(child);
      }
    }
  }
  collect(node);

  for (const tn of textNodes) {
    if (tn.fontName === figma.mixed) {
      const len = tn.characters.length;
      for (let i = 0; i < len; i++) {
        const font = tn.getRangeFontName(i, i + 1) as FontName;
        const key = fontKey(font);
        if (!loaded.has(key)) { loaded.add(key); try { await figma.loadFontAsync(font); } catch { /* skip */ } }
      }
    } else {
      const font = tn.fontName as FontName;
      const key = fontKey(font);
      if (!loaded.has(key)) { loaded.add(key); try { await figma.loadFontAsync(font); } catch { /* skip */ } }
    }
  }
}

// ── UI primitives ──

function applyText(node: TextNode, text: string, font: FontName, size: number, color: RGB) {
  node.fontName = font;
  node.fontSize = size;
  node.fills = [{ type: "SOLID", color }];
  node.characters = text;
}

function createLabel(text: string, font: FontName, size: number, color: RGB, maxWidth?: number): TextNode {
  const label = figma.createText();
  applyText(label, text, font, size, color);
  label.textAutoResize = "HEIGHT";
  if (maxWidth) label.resize(maxWidth, label.height);
  return label;
}

function createPill(text: string, font: FontName): FrameNode {
  const pill = figma.createFrame();
  pill.name = `Tag / ${text}`;
  pill.layoutMode = "HORIZONTAL";
  pill.primaryAxisSizingMode = "AUTO";
  pill.counterAxisSizingMode = "AUTO";
  pill.primaryAxisAlignItems = "CENTER";
  pill.counterAxisAlignItems = "CENTER";
  pill.paddingLeft = 12;
  pill.paddingRight = 12;
  pill.paddingTop = 6;
  pill.paddingBottom = 6;
  pill.cornerRadius = 999;
  pill.fills = [{ type: "SOLID", color: COLORS.tagBg }];
  pill.strokes = [{ type: "SOLID", color: COLORS.tagStroke }];
  pill.strokeWeight = 1;

  const label = createLabel(text, font, 11, COLORS.tag);
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  pill.appendChild(label);
  return pill;
}

function createStatusDot(color: RGB): FrameNode {
  const dot = figma.createFrame();
  dot.name = "Status dot";
  dot.resize(8, 8);
  dot.cornerRadius = 4;
  dot.fills = [{ type: "SOLID", color }];
  return dot;
}

// ── Component preview & placeholder ──

function createPlaceholder(component: DesignSystemComponentInfo, regularFont: FontName, semiBoldFont: FontName): FrameNode {
  const card = figma.createFrame();
  card.name = `Placeholder / ${component.name}`;
  card.layoutMode = "VERTICAL";
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.itemSpacing = 8;
  card.paddingLeft = 16;
  card.paddingRight = 16;
  card.paddingTop = 14;
  card.paddingBottom = 14;
  card.resize(CARD_WIDTH, 10);
  card.cornerRadius = 10;
  card.fills = [{ type: "SOLID", color: COLORS.white }];
  card.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  card.strokeWeight = 1;

  // Top row: status dot + type badge
  const topRow = figma.createFrame();
  topRow.name = "Top row";
  topRow.layoutMode = "HORIZONTAL";
  topRow.primaryAxisSizingMode = "AUTO";
  topRow.counterAxisSizingMode = "AUTO";
  topRow.counterAxisAlignItems = "CENTER";
  topRow.itemSpacing = 6;
  topRow.fills = [];
  topRow.appendChild(createStatusDot(component.source === "suggested" ? COLORS.placeholder : COLORS.accent));
  const typeBadge = createLabel(
    component.source === "suggested" ? "Suggested" : component.type === "COMPONENT_SET" ? "Component Set" : "Component",
    regularFont, 10, COLORS.meta,
  );
  typeBadge.textAutoResize = "WIDTH_AND_HEIGHT";
  topRow.appendChild(typeBadge);
  card.appendChild(topRow);

  // Name
  const name = createLabel(component.name, semiBoldFont, 14, COLORS.heading, CARD_WIDTH - 32);
  card.appendChild(name);

  // Page
  const pageLine = createLabel(`Page: ${component.pageName}`, regularFont, 11, COLORS.body, CARD_WIDTH - 32);
  card.appendChild(pageLine);

  // Role
  if (component.role && component.role !== "unknown") {
    const roleLine = createLabel(`Role: ${component.role}`, regularFont, 11, COLORS.body, CARD_WIDTH - 32);
    card.appendChild(roleLine);
  }

  // Variants count
  if (component.variantProperties) {
    const vCount = Object.keys(component.variantProperties).length;
    if (vCount > 0) {
      const vLine = createLabel(`${vCount} variant properties`, regularFont, 10, COLORS.meta, CARD_WIDTH - 32);
      card.appendChild(vLine);
    }
  }

  return card;
}

async function createComponentPreview(component: DesignSystemComponentInfo): Promise<SceneNode | null> {
  if (component.source === "suggested") return null;

  const nodeId = component.nodeId ?? (component.source === "library" ? undefined : component.id);
  const componentKey = component.componentKey ?? (component.source === "library" ? component.id : undefined);

  let sourceNode: ComponentNode | ComponentSetNode | null = null;

  // Try by node ID first
  if (nodeId) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (isSceneNode(node) && isComponentLike(node)) sourceNode = node;
    } catch { /* node not available */ }
  }

  // Try by component key
  if (!sourceNode && componentKey) {
    try {
      sourceNode = component.type === "COMPONENT_SET"
        ? await figma.importComponentSetByKeyAsync(componentKey)
        : await figma.importComponentByKeyAsync(componentKey);
    } catch { /* import failed */ }
  }

  if (!sourceNode) return null;

  const source = sourceNode.type === "COMPONENT_SET" ? findDefaultVariant(sourceNode) : sourceNode;
  if (!source) return null;

  try {
    const instance = source.createInstance();
    instance.name = `Instance / ${component.name}`;

    // Load fonts before any parent appends
    await loadInstanceFonts(instance);

    // Scale to fit within card bounds while maintaining aspect ratio
    const maxW = CARD_WIDTH;
    const maxH = CARD_HEIGHT;
    const scale = Math.min(1, maxW / Math.max(1, instance.width), maxH / Math.max(1, instance.height));
    if (scale < 1) instance.rescale(scale);

    return instance;
  } catch {
    return null;
  }
}

// ── Component card with wrapper frame ──

function createInstanceCard(instance: SceneNode, name: string, semiBoldFont: FontName): FrameNode {
  const card = figma.createFrame();
  card.name = `Card / ${name}`;
  card.layoutMode = "VERTICAL";
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.counterAxisAlignItems = "CENTER";
  card.itemSpacing = 8;
  card.paddingLeft = 12;
  card.paddingRight = 12;
  card.paddingTop = 12;
  card.paddingBottom = 10;
  card.resize(CARD_WIDTH, 10);
  card.cornerRadius = 10;
  card.fills = [{ type: "SOLID", color: COLORS.white }];
  card.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  card.strokeWeight = 1;

  // Instance preview wrapper
  const previewFrame = figma.createFrame();
  previewFrame.name = "Preview";
  previewFrame.resize(Math.min(CARD_WIDTH - 24, instance.width), Math.min(CARD_HEIGHT - 40, instance.height));
  previewFrame.fills = [];
  previewFrame.clipsContent = true;
  previewFrame.appendChild(instance);
  card.appendChild(previewFrame);

  // Label
  const label = createLabel(name, semiBoldFont, 11, COLORS.heading, CARD_WIDTH - 24);
  label.textTruncation = "ENDING";
  label.textAutoResize = "HEIGHT";
  card.appendChild(label);

  return card;
}

// ── Section builders ──

function createSection(title: string, regularFont: FontName, semiBoldFont: FontName, width: number): FrameNode {
  const section = figma.createFrame();
  section.name = `Section / ${title}`;
  section.layoutMode = "VERTICAL";
  section.primaryAxisSizingMode = "AUTO";
  section.counterAxisSizingMode = "FIXED";
  section.itemSpacing = 20;
  section.paddingLeft = 24;
  section.paddingRight = 24;
  section.paddingTop = 24;
  section.paddingBottom = 24;
  section.resize(width, 10);
  section.cornerRadius = 16;
  section.fills = [{ type: "SOLID", color: COLORS.white }];
  section.strokes = [{ type: "SOLID", color: COLORS.border }];
  section.strokeWeight = 1;

  const label = createLabel(title, semiBoldFont, 20, COLORS.heading, width - 48);
  section.appendChild(label);

  return section;
}

function createRow(name: string, width: number): FrameNode {
  const row = figma.createFrame();
  row.name = name;
  row.layoutMode = "HORIZONTAL";
  row.layoutWrap = "WRAP";
  row.primaryAxisSizingMode = "FIXED";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 14;
  row.counterAxisSpacing = 14;
  row.resize(width, 10);
  row.fills = [];
  return row;
}

function createEmptyState(text: string, font: FontName, width: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = "Empty state";
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.paddingTop = 32;
  frame.paddingBottom = 32;
  frame.resize(width, 10);
  frame.cornerRadius = 10;
  frame.fills = [{ type: "SOLID", color: COLORS.emptyBg }];
  frame.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  frame.strokeWeight = 1;
  frame.dashPattern = [6, 4];

  const label = createLabel(text, font, 12, COLORS.empty);
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  frame.appendChild(label);
  return frame;
}

// ── Append component cards to a container ──

async function appendComponentCards(
  container: FrameNode,
  components: DesignSystemComponentInfo[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
) {
  if (components.length === 0) {
    container.appendChild(createEmptyState("No matching components", fonts.regular, container.width - 28));
    return;
  }

  for (const component of components) {
    const preview = await createComponentPreview(component);
    if (preview) {
      state.instanceCount++;
      container.appendChild(createInstanceCard(preview, component.name, fonts.semiBold));
    } else {
      state.placeholderCount++;
      container.appendChild(createPlaceholder(component, fonts.regular, fonts.semiBold));
    }
  }
}

// ── Preview slot (used inside template layouts) ──

async function createPreviewSlot(
  title: string,
  components: DesignSystemComponentInfo[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const slot = figma.createFrame();
  slot.name = `Slot / ${title}`;
  slot.layoutMode = "VERTICAL";
  slot.primaryAxisSizingMode = "AUTO";
  slot.counterAxisSizingMode = "FIXED";
  slot.itemSpacing = 12;
  slot.paddingLeft = 14;
  slot.paddingRight = 14;
  slot.paddingTop = 14;
  slot.paddingBottom = 14;
  slot.resize(width, 10);
  slot.cornerRadius = 12;
  slot.fills = [{ type: "SOLID", color: COLORS.card }];
  slot.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  slot.strokeWeight = 1;

  // Slot header: title + count badge
  const headerRow = figma.createFrame();
  headerRow.name = "Slot header";
  headerRow.layoutMode = "HORIZONTAL";
  headerRow.primaryAxisSizingMode = "FIXED";
  headerRow.counterAxisSizingMode = "AUTO";
  headerRow.counterAxisAlignItems = "CENTER";
  headerRow.itemSpacing = 8;
  headerRow.resize(width - 28, 10);
  headerRow.fills = [];

  const label = createLabel(title, fonts.semiBold, 14, COLORS.heading);
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  label.layoutGrow = 1;
  headerRow.appendChild(label);

  const countBadge = createLabel(`${components.length}`, fonts.regular, 11, COLORS.accent);
  countBadge.textAutoResize = "WIDTH_AND_HEIGHT";
  headerRow.appendChild(countBadge);

  slot.appendChild(headerRow);

  const row = createRow(`${title} Components`, width - 28);
  await appendComponentCards(row, components, fonts, state);
  slot.appendChild(row);
  return slot;
}

// ── Component picking ──

function componentPickKey(component: DesignSystemComponentInfo): string {
  return component.componentKey ?? component.nodeId ?? `${component.source ?? "unknown"}:${component.pageName}:${component.name}`;
}

function dedupeComponents(components: DesignSystemComponentInfo[]): DesignSystemComponentInfo[] {
  const seen = new Set<string>();
  return components.filter(c => {
    const key = componentPickKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickComponents(
  components: DesignSystemComponentInfo[],
  pattern: RegExp,
  fallbackCount = 4,
  usedKeys = new Set<string>(),
): DesignSystemComponentInfo[] {
  const available = components.filter(c => !usedKeys.has(componentPickKey(c)));
  const realComponents = available.filter(c => c.source !== "suggested");
  const suggestedComponents = available.filter(c => c.source === "suggested");
  const matches = dedupeComponents([
    ...realComponents.filter(c => c.role ? pattern.test(c.role) : false),
    ...realComponents.filter(c => pattern.test(c.name)),
    ...suggestedComponents.filter(c => pattern.test(c.name) || (c.role ? pattern.test(c.role) : false)),
  ]);
  const selected = (matches.length > 0 ? matches : [...realComponents, ...suggestedComponents]).slice(0, fallbackCount);
  for (const c of selected) usedKeys.add(componentPickKey(c));
  return selected;
}

function findMappedComponents(project: FigmaProjectFrameRequest, sectionTitle: string): DesignSystemComponentInfo[] {
  const mappedKeys = project.templateComponentMappings?.[sectionTitle] ?? [];
  if (mappedKeys.length === 0) return [];
  const componentsByKey = new Map(project.components.map(c => [componentPickKey(c), c]));
  return mappedKeys.map(k => componentsByKey.get(k)).filter((c): c is DesignSystemComponentInfo => !!c);
}

function getSection(sections: { title: string; components: DesignSystemComponentInfo[] }[], title: string) {
  return sections.find(s => s.title === title) ?? { title, components: [] };
}

// ── Template layouts ──

async function createDashboardLayout(
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const shell = figma.createFrame();
  shell.name = "Dashboard / App layout";
  shell.layoutMode = "HORIZONTAL";
  shell.primaryAxisSizingMode = "FIXED";
  shell.counterAxisSizingMode = "AUTO";
  shell.itemSpacing = 16;
  shell.paddingLeft = 16;
  shell.paddingRight = 16;
  shell.paddingTop = 16;
  shell.paddingBottom = 16;
  shell.resize(width, 10);
  shell.cornerRadius = 12;
  shell.fills = [{ type: "SOLID", color: COLORS.white }];
  shell.strokes = [{ type: "SOLID", color: COLORS.border }];
  shell.strokeWeight = 1;

  const sidebarW = 280;
  const mainW = width - 32 - sidebarW - 16;

  const nav = getSection(templateSections, "Navigation and header");
  shell.appendChild(await createPreviewSlot("Navigation & header", nav.components, fonts, state, sidebarW));

  const main = figma.createFrame();
  main.name = "Dashboard / Main content";
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "AUTO";
  main.counterAxisSizingMode = "FIXED";
  main.itemSpacing = 16;
  main.resize(mainW, 10);
  main.fills = [];

  const kpi = getSection(templateSections, "KPI cards and charts");
  main.appendChild(await createPreviewSlot("KPI cards & charts", kpi.components, fonts, state, mainW));
  const table = getSection(templateSections, "Data table and activity");
  main.appendChild(await createPreviewSlot("Data table & activity", table.components, fonts, state, mainW));
  shell.appendChild(main);

  return shell;
}

async function createLandingLayout(
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const page = figma.createFrame();
  page.name = "Landing Page / Website layout";
  page.layoutMode = "VERTICAL";
  page.primaryAxisSizingMode = "AUTO";
  page.counterAxisSizingMode = "FIXED";
  page.itemSpacing = 16;
  page.paddingLeft = 16;
  page.paddingRight = 16;
  page.paddingTop = 16;
  page.paddingBottom = 16;
  page.resize(width, 10);
  page.cornerRadius = 12;
  page.fills = [{ type: "SOLID", color: COLORS.white }];
  page.strokes = [{ type: "SOLID", color: COLORS.border }];
  page.strokeWeight = 1;

  const innerW = width - 32;
  const hero = getSection(templateSections, "Hero and primary CTA");
  page.appendChild(await createPreviewSlot("Hero / navigation / primary CTA", hero.components, fonts, state, innerW));
  const features = getSection(templateSections, "Feature grid");
  page.appendChild(await createPreviewSlot("Feature grid", features.components, fonts, state, innerW));
  const proof = getSection(templateSections, "Pricing, proof, and footer");
  page.appendChild(await createPreviewSlot("Pricing / proof / footer", proof.components, fonts, state, innerW));

  return page;
}

async function createGenericLayout(
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  layoutName: string,
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const page = figma.createFrame();
  page.name = `${layoutName} / App layout`;
  page.layoutMode = "VERTICAL";
  page.primaryAxisSizingMode = "AUTO";
  page.counterAxisSizingMode = "FIXED";
  page.itemSpacing = 16;
  page.paddingLeft = 16;
  page.paddingRight = 16;
  page.paddingTop = 16;
  page.paddingBottom = 16;
  page.resize(width, 10);
  page.cornerRadius = 12;
  page.fills = [{ type: "SOLID", color: COLORS.white }];
  page.strokes = [{ type: "SOLID", color: COLORS.border }];
  page.strokeWeight = 1;

  const innerW = width - 32;
  for (const section of templateSections) {
    page.appendChild(await createPreviewSlot(section.title, section.components, fonts, state, innerW));
  }

  return page;
}

// ── Template preview wrapper ──

async function createTemplatePreview(
  project: FigmaProjectFrameRequest,
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
): Promise<FrameNode> {
  const width = CONTENT_WIDTH;
  const templateName = project.layoutTemplate || "Dashboard";

  const wrapper = createSection(`${templateName} — Component mapping`, fonts.regular, fonts.semiBold, width);
  wrapper.name = `Template Preview / ${templateName}`;

  const innerWidth = width - 48;

  let layout: FrameNode;
  switch (templateName) {
    case "Dashboard":
      layout = await createDashboardLayout(templateSections, fonts, state, innerWidth);
      break;
    case "Landing page":
      layout = await createLandingLayout(templateSections, fonts, state, innerWidth);
      break;
    default:
      layout = await createGenericLayout(templateSections, templateName, fonts, state, innerWidth);
      break;
  }

  wrapper.appendChild(layout);

  // Summary line
  const summary = createLabel(
    `${state.instanceCount} live instances · ${state.placeholderCount} placeholders`,
    fonts.regular, 12, COLORS.meta, innerWidth,
  );
  wrapper.appendChild(summary);

  return wrapper;
}

// ── Template section definitions ──

function getTemplateSections(project: FigmaProjectFrameRequest): { title: string; components: DesignSystemComponentInfo[] }[] {
  const components = project.components;
  const usedKeys = new Set<string>();
  const pick = (title: string, pattern: RegExp, fallbackCount: number) => {
    const mapped = findMappedComponents(project, title).filter(c => !usedKeys.has(componentPickKey(c)));
    if (mapped.length > 0) {
      for (const c of mapped) usedKeys.add(componentPickKey(c));
      return mapped;
    }
    return pickComponents(components, pattern, fallbackCount, usedKeys);
  };

  switch (project.layoutTemplate) {
    case "Admin table":
      return [
        { title: "Header and filters", components: pick("Header and filters", /nav|header|filter|search|input|select|button/i, 6) },
        { title: "Table and pagination", components: pick("Table and pagination", /table|row|cell|pagination|checkbox|badge/i, 8) },
        { title: "Empty, loading, and error states", components: pick("Empty, loading, and error states", /empty|loading|skeleton|alert|toast|error/i, 4) },
      ];
    case "Settings":
      return [
        { title: "Settings navigation", components: pick("Settings navigation", /nav|tab|menu|sidebar/i, 4) },
        { title: "Form groups", components: pick("Form groups", /form|field|input|select|checkbox|radio|switch|button/i, 8) },
        { title: "Save and danger actions", components: pick("Save and danger actions", /button|alert|modal|dialog|toast/i, 5) },
      ];
    case "Landing page":
      return [
        { title: "Hero and primary CTA", components: pick("Hero and primary CTA", /hero|nav|button|badge|card/i, 6) },
        { title: "Feature grid", components: pick("Feature grid", /feature|card|tile|icon|badge/i, 8) },
        { title: "Pricing, proof, and footer", components: pick("Pricing, proof, and footer", /pricing|testimonial|logo|footer|card/i, 6) },
      ];
    case "Mobile app":
      return [
        { title: "Mobile shell", components: pick("Mobile shell", /mobile|nav|tab|bar|header/i, 4) },
        { title: "Content list", components: pick("Content list", /card|item|row|list|avatar|badge/i, 8) },
        { title: "Primary actions", components: pick("Primary actions", /button|input|modal|toast|empty/i, 6) },
      ];
    case "AI workspace":
      return [
        { title: "Conversation and sidebar", components: pick("Conversation and sidebar", /chat|conversation|message|sidebar|nav/i, 6) },
        { title: "Prompt composer", components: pick("Prompt composer", /prompt|input|textarea|button|select|model/i, 6) },
        { title: "Response, sources, and actions", components: pick("Response, sources, and actions", /response|source|citation|card|toolbar|button/i, 8) },
      ];
    case "Developer console":
      return [
        { title: "Console shell", components: pick("Console shell", /nav|sidebar|toolbar|command|menu/i, 6) },
        { title: "Resources and details", components: pick("Resources and details", /table|list|row|card|panel|detail/i, 8) },
        { title: "Logs and status", components: pick("Logs and status", /log|code|terminal|status|badge|alert/i, 6) },
      ];
    case "Dashboard":
    default:
      return [
        { title: "Navigation and header", components: pick("Navigation and header", /nav|header|menu|tab|button/i, 6) },
        { title: "KPI cards and charts", components: pick("KPI cards and charts", /metric|kpi|card|chart|graph|badge/i, 8) },
        { title: "Data table and activity", components: pick("Data table and activity", /table|row|list|activity|feed|avatar/i, 8) },
      ];
  }
}

// ── Main frame builder ──

async function createProjectFrame(project: FigmaProjectFrameRequest): Promise<void> {
  const regularFont = await loadPreferredFont("Regular");
  const semiBoldFont = await loadPreferredFont("Semi Bold");
  const fonts = { regular: regularFont, semiBold: semiBoldFont };

  // Root frame
  const frame = figma.createFrame();
  frame.name = `${project.projectName || "DesignReady"} / Project Layout`;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = 32;
  frame.paddingLeft = FRAME_PADDING;
  frame.paddingRight = FRAME_PADDING;
  frame.paddingTop = FRAME_PADDING;
  frame.paddingBottom = FRAME_PADDING;
  frame.resize(FRAME_WIDTH, 10);
  frame.fills = [{ type: "SOLID", color: COLORS.bg }];

  // ── Header ──
  const header = figma.createFrame();
  header.name = "Project Header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "FIXED";
  header.itemSpacing = 12;
  header.resize(CONTENT_WIDTH, 10);
  header.fills = [];

  const title = createLabel(project.projectName || "DesignReady Project", semiBoldFont, 36, COLORS.title, CONTENT_WIDTH);
  header.appendChild(title);

  const subtitle = createLabel(
    `${project.industry} · ${project.style} · ${project.presetName}`,
    regularFont, 16, COLORS.body, CONTENT_WIDTH,
  );
  header.appendChild(subtitle);

  // Tag row
  const tagRow = figma.createFrame();
  tagRow.name = "Project Metadata";
  tagRow.layoutMode = "HORIZONTAL";
  tagRow.layoutWrap = "WRAP";
  tagRow.primaryAxisSizingMode = "FIXED";
  tagRow.counterAxisSizingMode = "AUTO";
  tagRow.itemSpacing = 8;
  tagRow.counterAxisSpacing = 8;
  tagRow.resize(CONTENT_WIDTH, 10);
  tagRow.fills = [];

  const totalCount = project.components.length;
  const realCount = project.components.filter(c => c.source !== "suggested").length;
  const suggestedCount = totalCount - realCount;

  tagRow.appendChild(createPill(`${totalCount} components`, regularFont));
  if (realCount > 0) tagRow.appendChild(createPill(`${realCount} real`, regularFont));
  if (suggestedCount > 0) tagRow.appendChild(createPill(`${suggestedCount} suggested`, regularFont));
  tagRow.appendChild(createPill(`${project.variables.length} variables`, regularFont));
  tagRow.appendChild(createPill(project.layoutTemplate || "Dashboard", regularFont));
  tagRow.appendChild(createPill("AI-ready layout", regularFont));
  header.appendChild(tagRow);

  frame.appendChild(header);

  // ── Template preview ──
  const state: FrameBuildState = { instanceCount: 0, placeholderCount: 0 };
  const templateSections = getTemplateSections(project);
  frame.appendChild(await createTemplatePreview(project, templateSections, fonts, state));

  // ── Component inventory (all components in a grid) ──
  if (project.components.length > 0) {
    const inventory = createSection("Component inventory", regularFont, semiBoldFont, CONTENT_WIDTH);
    inventory.name = "Component Inventory";

    const inventoryRow = createRow("All components", CONTENT_WIDTH - 48);
    const shown = new Set<string>();
    for (const comp of project.components) {
      const key = componentPickKey(comp);
      if (shown.has(key)) continue;
      shown.add(key);
      const preview = await createComponentPreview(comp);
      if (preview) {
        state.instanceCount++;
        inventoryRow.appendChild(createInstanceCard(preview, comp.name, semiBoldFont));
      } else {
        state.placeholderCount++;
        inventoryRow.appendChild(createPlaceholder(comp, regularFont, semiBoldFont));
      }
    }
    inventory.appendChild(inventoryRow);
    frame.appendChild(inventory);
  }

  // ── Finalize ──
  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  const message = state.instanceCount > 0
    ? `Created ${project.layoutTemplate || "Dashboard"} layout with ${state.instanceCount} live instances and ${state.placeholderCount} placeholders.`
    : `Created ${project.layoutTemplate || "Dashboard"} layout with ${state.placeholderCount} component placeholders.`;
  figma.notify(message, { timeout: 5000 });
  figma.ui.postMessage({
    type: "figma-project-frame-result",
    nodeId: frame.id,
    created: true,
    instanceCount: state.instanceCount,
    placeholderCount: state.placeholderCount,
    message,
  } satisfies PluginMessage);
}

// ── Handler ──

export async function handleProjectFrameMessage(msg: PluginMessage): Promise<boolean> {
  if (msg.type !== "create-figma-project-frame") return false;

  try {
    await createProjectFrame(msg.project);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    figma.notify(`Could not create project frame: ${message}`, { error: true, timeout: 5000 });
    figma.ui.postMessage({
      type: "figma-project-frame-result",
      created: false,
      instanceCount: 0,
      placeholderCount: 0,
      message,
    } satisfies PluginMessage);
  }
  return true;
}
