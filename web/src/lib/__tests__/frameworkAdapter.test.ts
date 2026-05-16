/**
 * Framework adapter tests.
 *
 * Verifies React, Vue, and Svelte code generation from SerializedNodes.
 */

import { describe, it, expect } from "vitest";
import { ReactAdapter, VueAdapter, SvelteAdapter, generateCode, getAdapter, getAvailableAdapters } from "../frameworkAdapter";
import { getDefaultConfig } from "../../../../shared/frameworks";
import type { SerializedNode } from "../../../../shared/types";

function createMockNode(overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id: "node-1",
    name: "ActionButton",
    type: "COMPONENT",
    width: 120,
    height: 44,
    layoutMode: "HORIZONTAL",
    itemSpacing: 8,
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 12,
    paddingLeft: 24,
    cornerRadius: 8,
    fills: [{ type: "SOLID", color: { r: 0, g: 0.83, b: 1 } }],
    children: [
      { id: "text-1", name: "Label", type: "TEXT", characters: "Click me", fontSize: 14, fontWeight: 600 } as SerializedNode,
    ],
    ...overrides,
  } as SerializedNode;
}

describe("Framework Adapters", () => {
  describe("ReactAdapter", () => {
    const adapter = new ReactAdapter();
    const config = getDefaultConfig("react");
    const node = createMockNode();

    it("generates component file", () => {
      const result = adapter.generate(node, config);
      expect(result.framework).toBe("react");
      expect(result.componentName).toBe("ActionButton");
      expect(result.files.length).toBeGreaterThan(0);

      const component = result.files.find(f => f.type === "component");
      expect(component).toBeDefined();
      expect(component!.content).toContain("ActionButton");
      expect(component!.content).toContain("export");
      expect(component!.path).toContain(".tsx");
    });

    it("generates styles file", () => {
      const result = adapter.generate(node, config);
      const styles = result.files.find(f => f.type === "style");
      expect(styles).toBeDefined();
      expect(styles!.content).toContain(".root");
      expect(styles!.content).toContain("display: flex");
      expect(styles!.content).toContain("gap: 8px");
      expect(styles!.path).toContain(".module.scss");
    });

    it("generates types file", () => {
      const result = adapter.generate(node, config);
      const types = result.files.find(f => f.type === "types");
      expect(types).toBeDefined();
      expect(types!.content).toContain("ActionButtonProps");
      expect(types!.content).toContain("className?: string");
    });

    it("generates barrel export", () => {
      const result = adapter.generate(node, config);
      const barrel = result.files.find(f => f.type === "barrel");
      expect(barrel).toBeDefined();
      expect(barrel!.content).toContain("export { ActionButton }");
    });

    it("generates storybook file when feature enabled", () => {
      const configWithStory = { ...config, features: ["storybook"] };
      const result = adapter.generate(node, configWithStory);
      const story = result.files.find(f => f.type === "story");
      expect(story).toBeDefined();
      expect(story!.content).toContain("@storybook/react-vite");
      expect(story!.content).toContain("ActionButton");
    });

    it("uses forwardRef when feature enabled", () => {
      const configWithRef = { ...config, features: ["forwardRef", "storybook"] };
      const result = adapter.generate(node, configWithRef);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain("forwardRef");
    });

    it("includes correct padding values", () => {
      const result = adapter.generate(node, config);
      const styles = result.files.find(f => f.type === "style");
      expect(styles!.content).toContain("padding-top: 12px");
      expect(styles!.content).toContain("padding-right: 24px");
    });

    it("includes border-radius", () => {
      const result = adapter.generate(node, config);
      const styles = result.files.find(f => f.type === "style");
      expect(styles!.content).toContain("border-radius: 8px");
    });

    it("generates variant props from available variants", () => {
      const nodeWithVariants = createMockNode({
        availableVariants: { Size: ["sm", "md", "lg"], State: ["default", "hover"] },
      });
      const types = adapter.generateTypes(nodeWithVariants, "Button");
      expect(types).toContain('"sm" | "md" | "lg"');
      expect(types).toContain('"default" | "hover"');
    });
  });

  describe("VueAdapter", () => {
    const adapter = new VueAdapter();
    const config = getDefaultConfig("vue");
    const node = createMockNode();

    it("generates SFC file", () => {
      const result = adapter.generate(node, config);
      expect(result.framework).toBe("vue");
      const component = result.files.find(f => f.type === "component");
      expect(component).toBeDefined();
      expect(component!.path).toContain(".vue");
      expect(component!.content).toContain("<template>");
      expect(component!.content).toContain("<script setup");
      expect(component!.content).toContain("<style");
    });

    it("uses scoped styles", () => {
      const result = adapter.generate(node, config);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain("scoped");
    });

    it("uses lang=ts in script", () => {
      const result = adapter.generate(node, config);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain('lang="ts"');
    });

    it("includes slot for children", () => {
      const result = adapter.generate(node, config);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain("<slot");
    });

    it("generates barrel export", () => {
      const result = adapter.generate(node, config);
      const barrel = result.files.find(f => f.type === "barrel");
      expect(barrel).toBeDefined();
      expect(barrel!.content).toContain("ActionButton");
    });
  });

  describe("SvelteAdapter", () => {
    const adapter = new SvelteAdapter();
    const config = getDefaultConfig("svelte");
    const node = createMockNode();

    it("generates Svelte file", () => {
      const result = adapter.generate(node, config);
      expect(result.framework).toBe("svelte");
      const component = result.files.find(f => f.type === "component");
      expect(component).toBeDefined();
      expect(component!.path).toContain(".svelte");
    });

    it("uses Svelte 5 runes ($props) when enabled", () => {
      const result = adapter.generate(node, config);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain("$props()");
    });

    it("includes style block", () => {
      const result = adapter.generate(node, config);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain("<style>");
      expect(component!.content).toContain(".root");
    });

    it("uses @render for children (Svelte 5 snippets)", () => {
      const result = adapter.generate(node, config);
      const component = result.files.find(f => f.type === "component");
      expect(component!.content).toContain("@render");
    });
  });

  describe("generateCode (unified API)", () => {
    it("generates React code", () => {
      const node = createMockNode();
      const config = getDefaultConfig("react");
      const result = generateCode(node, config);
      expect(result.framework).toBe("react");
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("generates Vue code", () => {
      const node = createMockNode();
      const config = getDefaultConfig("vue");
      const result = generateCode(node, config);
      expect(result.framework).toBe("vue");
    });

    it("returns warning for unsupported framework", () => {
      const node = createMockNode();
      const config = { ...getDefaultConfig("react"), framework: "flutter" as const };
      const result = generateCode(node, config);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("flutter");
    });
  });

  describe("adapter registry", () => {
    it("getAdapter returns correct adapter", () => {
      expect(getAdapter("react")).toBeInstanceOf(ReactAdapter);
      expect(getAdapter("vue")).toBeInstanceOf(VueAdapter);
      expect(getAdapter("svelte")).toBeInstanceOf(SvelteAdapter);
    });

    it("getAvailableAdapters returns all adapters", () => {
      const adapters = getAvailableAdapters();
      expect(adapters.length).toBe(3);
    });
  });
});
