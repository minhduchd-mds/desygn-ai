/**
 * frameworkAdapter — Multi-framework code generation engine.
 *
 * Translates SerializedNode trees into framework-specific code.
 * Each adapter produces production-ready component files.
 *
 * Architecture:
 *   SerializedNode → FrameworkAdapter.generate() → GeneratedFile[]
 *
 * Supported Frameworks:
 *   • React (TSX + CSS Modules / Tailwind)
 *   • Vue 3 (SFC + Composition API)
 *   • Svelte 5 (Runes + Snippets)
 *   • Web Components (Shadow DOM + Custom Elements)
 */

import type { SerializedNode } from "../../../shared/types";
import type {
  FrameworkId,
  GenerationConfig,
  GeneratedFile,
  GenerationResult,
} from "../../../shared/frameworks";

// ── Adapter Interface ─────────────────────────────────────────

export interface FrameworkAdapter {
  readonly id: FrameworkId;
  readonly name: string;

  /** Generate component files from a serialized node tree. */
  generate(node: SerializedNode, config: GenerationConfig): GenerationResult;

  /** Generate props/types interface from node properties. */
  generateTypes(node: SerializedNode, componentName: string): string;

  /** Generate styles from node visual properties. */
  generateStyles(node: SerializedNode, config: GenerationConfig): string;
}

// ── Shared Utilities ──────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function extractProps(node: SerializedNode): { name: string; type: string; optional: boolean }[] {
  const props: { name: string; type: string; optional: boolean }[] = [];

  // Children prop
  if (node.children?.length) {
    props.push({ name: "children", type: "React.ReactNode", optional: true });
  }

  // Variant props from component properties
  if (node.variantProperties) {
    for (const key of Object.keys(node.variantProperties)) {
      props.push({ name: toCamelCase(key), type: "string", optional: true });
    }
  }

  // Available variants as union types
  if (node.availableVariants) {
    for (const [key, values] of Object.entries(node.availableVariants)) {
      const unionType = values.map(v => `"${v}"`).join(" | ");
      props.push({ name: toCamelCase(key), type: unionType, optional: true });
    }
  }

  return props;
}

function extractStyles(node: SerializedNode): Record<string, string> {
  const styles: Record<string, string> = {};

  if (node.layoutMode === "HORIZONTAL") styles.display = "flex";
  if (node.layoutMode === "VERTICAL") { styles.display = "flex"; styles.flexDirection = "column"; }
  if (node.itemSpacing) styles.gap = `${node.itemSpacing}px`;
  if (node.paddingTop) styles.paddingTop = `${node.paddingTop}px`;
  if (node.paddingRight) styles.paddingRight = `${node.paddingRight}px`;
  if (node.paddingBottom) styles.paddingBottom = `${node.paddingBottom}px`;
  if (node.paddingLeft) styles.paddingLeft = `${node.paddingLeft}px`;
  if (node.width) styles.width = `${node.width}px`;
  if (node.height) styles.height = `${node.height}px`;

  if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
    styles.borderRadius = `${node.cornerRadius}px`;
  }

  if (node.opacity !== undefined && node.opacity < 1) {
    styles.opacity = String(node.opacity);
  }

  if (node.fills?.length) {
    const solid = node.fills.find(f => f.type === "SOLID" && f.color);
    if (solid?.color) {
      const r = Math.round(solid.color.r * 255);
      const g = Math.round(solid.color.g * 255);
      const b = Math.round(solid.color.b * 255);
      if (node.type === "TEXT") {
        styles.color = `rgb(${r}, ${g}, ${b})`;
      } else {
        styles.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }
    }
  }

  if (node.fontSize) styles.fontSize = `${node.fontSize}px`;
  if (node.fontWeight) styles.fontWeight = String(node.fontWeight);
  if (node.lineHeight && typeof node.lineHeight === "number") {
    styles.lineHeight = String(node.lineHeight);
  }

  return styles;
}

// ── React Adapter ─────────────────────────────────────────────

export class ReactAdapter implements FrameworkAdapter {
  readonly id: FrameworkId = "react";
  readonly name = "React";

  generate(node: SerializedNode, config: GenerationConfig): GenerationResult {
    const componentName = toPascalCase(node.name);
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];

    // Component file
    const componentCode = this.generateComponent(node, componentName, config);
    files.push({
      path: `${componentName}/${componentName}.tsx`,
      content: componentCode,
      type: "component",
    });

    // Styles file
    const stylesCode = this.generateStyles(node, config);
    if (config.styling === "css-modules") {
      files.push({
        path: `${componentName}/${componentName}.module.scss`,
        content: stylesCode,
        type: "style",
      });
    }

    // Types file
    const typesCode = this.generateTypes(node, componentName);
    files.push({
      path: `${componentName}/${componentName}.types.ts`,
      content: typesCode,
      type: "types",
    });

    // Barrel export
    if (config.output.barrel) {
      files.push({
        path: `${componentName}/index.ts`,
        content: `export { ${componentName} } from "./${componentName}";\nexport type { ${componentName}Props } from "./${componentName}.types";\n`,
        type: "barrel",
      });
    }

    // Storybook
    if (config.features.includes("storybook")) {
      files.push({
        path: `${componentName}/${componentName}.stories.tsx`,
        content: this.generateStory(componentName, config),
        type: "story",
      });
    }

    return { files, framework: "react", componentName, warnings };
  }

  generateTypes(node: SerializedNode, componentName: string): string {
    const props = extractProps(node);
    const lines = [
      `export interface ${componentName}Props {`,
      ...props.map(p => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`),
      `  className?: string;`,
      `}`,
    ];
    return lines.join("\n") + "\n";
  }

  generateStyles(node: SerializedNode, config: GenerationConfig): string {
    const styles = extractStyles(node);

    if (config.styling === "css-modules") {
      const cssLines = [`.root {`];
      for (const [prop, value] of Object.entries(styles)) {
        cssLines.push(`  ${toKebabCase(prop)}: ${value};`);
      }
      cssLines.push(`}`);
      return cssLines.join("\n") + "\n";
    }

    return "";
  }

  private generateComponent(node: SerializedNode, name: string, config: GenerationConfig): string {
    const props = extractProps(node);
    const hasChildren = props.some(p => p.name === "children");
    const useForwardRef = config.features.includes("forwardRef");

    const imports = [`import type { ${name}Props } from "./${name}.types";`];
    if (config.styling === "css-modules") {
      imports.push(`import styles from "./${name}.module.scss";`);
    }

    let body: string;
    if (useForwardRef) {
      body = [
        `export const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(`,
        `  function ${name}({ ${hasChildren ? "children, " : ""}className, ...props }, ref) {`,
        `    return (`,
        `      <div ref={ref} className={\`\${styles.root} \${className ?? ""}\`} {...props}>`,
        hasChildren ? `        {children}` : `        {/* content */}`,
        `      </div>`,
        `    );`,
        `  }`,
        `);`,
      ].join("\n");
      imports.unshift(`import React from "react";`);
    } else {
      body = [
        `export function ${name}({ ${hasChildren ? "children, " : ""}className }: ${name}Props) {`,
        `  return (`,
        `    <div className={\`\${styles.root} \${className ?? ""}\`}>`,
        hasChildren ? `      {children}` : `      {/* content */}`,
        `    </div>`,
        `  );`,
        `}`,
      ].join("\n");
    }

    return `${imports.join("\n")}\n\n${body}\n`;
  }

  private generateStory(name: string, _config: GenerationConfig): string {
    return [
      `import type { Meta, StoryObj } from "@storybook/react-vite";`,
      `import { ${name} } from "./${name}";`,
      ``,
      `const meta: Meta<typeof ${name}> = {`,
      `  title: "Components/${name}",`,
      `  component: ${name},`,
      `  parameters: { layout: "centered" },`,
      `};`,
      ``,
      `export default meta;`,
      `type Story = StoryObj<typeof ${name}>;`,
      ``,
      `export const Default: Story = {`,
      `  args: {},`,
      `};`,
      ``,
    ].join("\n");
  }
}

// ── Vue Adapter ───────────────────────────────────────────────

export class VueAdapter implements FrameworkAdapter {
  readonly id: FrameworkId = "vue";
  readonly name = "Vue 3";

  generate(node: SerializedNode, config: GenerationConfig): GenerationResult {
    const componentName = toPascalCase(node.name);
    const files: GeneratedFile[] = [];

    // SFC file
    const sfcCode = this.generateSFC(node, componentName, config);
    files.push({
      path: `${componentName}/${componentName}.vue`,
      content: sfcCode,
      type: "component",
    });

    // Barrel
    if (config.output.barrel) {
      files.push({
        path: `${componentName}/index.ts`,
        content: `export { default as ${componentName} } from "./${componentName}.vue";\n`,
        type: "barrel",
      });
    }

    return { files, framework: "vue", componentName, warnings: [] };
  }

  generateTypes(node: SerializedNode, componentName: string): string {
    const props = extractProps(node).filter(p => p.name !== "children");
    const lines = [
      `export interface ${componentName}Props {`,
      ...props.map(p => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`),
      `}`,
    ];
    return lines.join("\n") + "\n";
  }

  generateStyles(node: SerializedNode, _config: GenerationConfig): string {
    const styles = extractStyles(node);
    const lines = [`.root {`];
    for (const [prop, value] of Object.entries(styles)) {
      lines.push(`  ${toKebabCase(prop)}: ${value};`);
    }
    lines.push(`}`);
    return lines.join("\n") + "\n";
  }

  private generateSFC(node: SerializedNode, _name: string, _config: GenerationConfig): string {
    const props = extractProps(node).filter(p => p.name !== "children");
    const hasSlot = node.children && node.children.length > 0;
    const styles = extractStyles(node);

    const propsDecl = props.length > 0
      ? `\ninterface Props {\n${props.map(p => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`).join("\n")}\n}\n\ndefineProps<Props>();`
      : "";

    const template = [
      `<template>`,
      `  <div class="root">`,
      hasSlot ? `    <slot />` : `    <!-- content -->`,
      `  </div>`,
      `</template>`,
    ].join("\n");

    const script = [
      `<script setup lang="ts">${propsDecl}`,
      `</script>`,
    ].join("\n");

    const styleLines = Object.entries(styles)
      .map(([prop, value]) => `  ${toKebabCase(prop)}: ${value};`)
      .join("\n");

    const style = [
      `<style scoped lang="scss">`,
      `.root {`,
      styleLines,
      `}`,
      `</style>`,
    ].join("\n");

    return `${template}\n\n${script}\n\n${style}\n`;
  }
}

// ── Svelte Adapter ────────────────────────────────────────────

export class SvelteAdapter implements FrameworkAdapter {
  readonly id: FrameworkId = "svelte";
  readonly name = "Svelte 5";

  generate(node: SerializedNode, config: GenerationConfig): GenerationResult {
    const componentName = toPascalCase(node.name);
    const files: GeneratedFile[] = [];

    // Svelte file
    const svelteCode = this.generateSvelteFile(node, componentName, config);
    files.push({
      path: `${componentName}/${componentName}.svelte`,
      content: svelteCode,
      type: "component",
    });

    // Barrel
    if (config.output.barrel) {
      files.push({
        path: `${componentName}/index.ts`,
        content: `export { default as ${componentName} } from "./${componentName}.svelte";\n`,
        type: "barrel",
      });
    }

    return { files, framework: "svelte", componentName, warnings: [] };
  }

  generateTypes(node: SerializedNode, componentName: string): string {
    const props = extractProps(node).filter(p => p.name !== "children");
    const lines = [
      `export interface ${componentName}Props {`,
      ...props.map(p => `  ${p.name}${p.optional ? "?" : ""}: ${p.type};`),
      `}`,
    ];
    return lines.join("\n") + "\n";
  }

  generateStyles(node: SerializedNode, _config: GenerationConfig): string {
    const styles = extractStyles(node);
    const lines = [`.root {`];
    for (const [prop, value] of Object.entries(styles)) {
      lines.push(`  ${toKebabCase(prop)}: ${value};`);
    }
    lines.push(`}`);
    return lines.join("\n") + "\n";
  }

  private generateSvelteFile(node: SerializedNode, name: string, config: GenerationConfig): string {
    const props = extractProps(node).filter(p => p.name !== "children");
    const hasChildren = node.children && node.children.length > 0;
    const styles = extractStyles(node);
    const useRunes = config.features.includes("runes");

    let propsDecl: string;
    if (useRunes) {
      propsDecl = props.length > 0
        ? props.map(p => `  let { ${p.name}${p.optional ? " = undefined" : ""} }: { ${p.name}${p.optional ? "?" : ""}: ${p.type} } = $props();`).join("\n")
        : `  let { children } = $props();`;
    } else {
      propsDecl = props.length > 0
        ? `  export let ${props.map(p => p.name).join(", ")};`
        : "";
    }

    const script = `<script lang="ts">\n${propsDecl}\n</script>`;

    const template = [
      `<div class="root">`,
      hasChildren ? `  {@render children?.()}` : `  <!-- content -->`,
      `</div>`,
    ].join("\n");

    const styleLines = Object.entries(styles)
      .map(([prop, value]) => `  ${toKebabCase(prop)}: ${value};`)
      .join("\n");

    const style = `<style>\n.root {\n${styleLines}\n}\n</style>`;

    return `${script}\n\n${template}\n\n${style}\n`;
  }
}

// ── Adapter Registry ──────────────────────────────────────────

const adapters = new Map<FrameworkId, FrameworkAdapter>();
adapters.set("react", new ReactAdapter());
adapters.set("vue", new VueAdapter());
adapters.set("svelte", new SvelteAdapter());

/**
 * Get a framework adapter by ID.
 */
export function getAdapter(framework: FrameworkId): FrameworkAdapter | undefined {
  return adapters.get(framework);
}

/**
 * Get all available adapters.
 */
export function getAvailableAdapters(): FrameworkAdapter[] {
  return [...adapters.values()];
}

/**
 * Generate code for a node using the specified framework.
 */
export function generateCode(
  node: SerializedNode,
  config: GenerationConfig,
): GenerationResult {
  const adapter = adapters.get(config.framework);
  if (!adapter) {
    return {
      files: [],
      framework: config.framework,
      componentName: toPascalCase(node.name),
      warnings: [`No adapter available for framework: ${config.framework}`],
    };
  }
  return adapter.generate(node, config);
}
