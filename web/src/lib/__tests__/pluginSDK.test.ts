/**
 * Plugin SDK tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PluginRegistry,
  createAdapterPlugin,
  createAnalyzerPlugin,
} from "../pluginSDK";
import type { PluginManifest, PluginAPI, PluginEvent } from "../pluginSDK";

function createMockManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: `plugin-${Math.random().toString(36).slice(2, 6)}`,
    name: "Test Plugin",
    version: "1.0.0",
    author: "Test Author",
    description: "A test plugin",
    extensionPoint: "adapter",
    capabilities: { readDesign: true, generateFiles: true, modifyTokens: false, network: false, storage: false },
    entryPoint: "plugins/test/index.ts",
    ...overrides,
  };
}

function createMockAPI(overrides: Partial<PluginAPI> = {}): PluginAPI {
  return {
    contribute: () => ({
      type: "adapter" as const,
      frameworkId: "test",
      frameworkName: "Test Framework",
      generate: () => ({ files: [{ path: "test.ts", content: "// test" }] }),
    }),
    ...overrides,
  };
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe("registration", () => {
    it("registers a plugin", () => {
      const manifest = createMockManifest();
      const result = registry.register(manifest, createMockAPI());
      expect(result).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("prevents duplicate registration", () => {
      const manifest = createMockManifest({ id: "dup" });
      registry.register(manifest, createMockAPI());
      expect(registry.register(manifest, createMockAPI())).toBe(false);
    });

    it("rejects invalid manifest (no name)", () => {
      const manifest = createMockManifest({ name: "" });
      const result = registry.register(manifest, createMockAPI());
      expect(result).toBe(false);
      expect(registry.getPlugin(manifest.id)?.status).toBe("error");
    });

    it("rejects invalid version", () => {
      const manifest = createMockManifest({ version: "bad" });
      const result = registry.register(manifest, createMockAPI());
      expect(result).toBe(false);
    });

    it("rejects invalid extension point", () => {
      const manifest = createMockManifest({ extensionPoint: "invalid" as never });
      const result = registry.register(manifest, createMockAPI());
      expect(result).toBe(false);
    });

    it("checks dependencies exist", () => {
      const manifest = createMockManifest({ dependencies: ["non-existent"] });
      const result = registry.register(manifest, createMockAPI());
      expect(result).toBe(false);
      expect(registry.getPlugin(manifest.id)?.error).toContain("Missing dependency");
    });

    it("resolves existing dependencies", () => {
      const dep = createMockManifest({ id: "dep-plugin" });
      registry.register(dep, createMockAPI());

      const manifest = createMockManifest({ dependencies: ["dep-plugin"] });
      expect(registry.register(manifest, createMockAPI())).toBe(true);
    });
  });

  describe("activation", () => {
    it("activates a registered plugin", async () => {
      const manifest = createMockManifest({ id: "act" });
      registry.register(manifest, createMockAPI());

      const result = await registry.activate("act");
      expect(result).toBe(true);
      expect(registry.getPlugin("act")?.status).toBe("active");
    });

    it("calls activate hook", async () => {
      let activated = false;
      const manifest = createMockManifest({ id: "hook" });
      registry.register(manifest, createMockAPI({ activate: () => { activated = true; } }));

      await registry.activate("hook");
      expect(activated).toBe(true);
    });

    it("handles activation errors", async () => {
      const manifest = createMockManifest({ id: "err" });
      registry.register(manifest, createMockAPI({
        activate: () => { throw new Error("init failed"); },
      }));

      const result = await registry.activate("err");
      expect(result).toBe(false);
      expect(registry.getPlugin("err")?.status).toBe("error");
    });

    it("returns false for non-existent plugin", async () => {
      expect(await registry.activate("ghost")).toBe(false);
    });
  });

  describe("deactivation", () => {
    it("deactivates an active plugin", async () => {
      const manifest = createMockManifest({ id: "deact" });
      registry.register(manifest, createMockAPI());
      await registry.activate("deact");

      const result = await registry.deactivate("deact");
      expect(result).toBe(true);
      expect(registry.getPlugin("deact")?.status).toBe("disabled");
    });

    it("calls deactivate hook", async () => {
      let deactivated = false;
      const manifest = createMockManifest({ id: "dhook" });
      registry.register(manifest, createMockAPI({ deactivate: () => { deactivated = true; } }));
      await registry.activate("dhook");

      await registry.deactivate("dhook");
      expect(deactivated).toBe(true);
    });

    it("returns false for inactive plugin", async () => {
      const manifest = createMockManifest({ id: "inactive" });
      registry.register(manifest, createMockAPI());
      expect(await registry.deactivate("inactive")).toBe(false);
    });
  });

  describe("unregistration", () => {
    it("unregisters a plugin", () => {
      const manifest = createMockManifest({ id: "unreg" });
      registry.register(manifest, createMockAPI());
      expect(registry.unregister("unreg")).toBe(true);
      expect(registry.size).toBe(0);
    });

    it("prevents unregistering if depended upon", () => {
      const dep = createMockManifest({ id: "base-plugin" });
      registry.register(dep, createMockAPI());

      const dependent = createMockManifest({ id: "child", dependencies: ["base-plugin"] });
      registry.register(dependent, createMockAPI());

      expect(registry.unregister("base-plugin")).toBe(false);
    });

    it("returns false for non-existent", () => {
      expect(registry.unregister("ghost")).toBe(false);
    });
  });

  describe("querying", () => {
    it("gets all plugins", () => {
      registry.register(createMockManifest({ id: "a" }), createMockAPI());
      registry.register(createMockManifest({ id: "b" }), createMockAPI());
      expect(registry.getPlugins().length).toBe(2);
    });

    it("gets active plugins", async () => {
      registry.register(createMockManifest({ id: "x" }), createMockAPI());
      registry.register(createMockManifest({ id: "y" }), createMockAPI());
      await registry.activate("x");

      expect(registry.getActivePlugins().length).toBe(1);
      expect(registry.activeCount).toBe(1);
    });

    it("gets plugins by extension point", async () => {
      registry.register(createMockManifest({ id: "adp", extensionPoint: "adapter" }), createMockAPI());
      registry.register(createMockManifest({ id: "ana", extensionPoint: "analyzer" }), createMockAPI());
      await registry.activate("adp");
      await registry.activate("ana");

      expect(registry.getByExtensionPoint("adapter").length).toBe(1);
      expect(registry.getByExtensionPoint("analyzer").length).toBe(1);
    });

    it("gets contributions from active plugins", async () => {
      registry.register(createMockManifest({ id: "contrib", extensionPoint: "adapter" }), createMockAPI());
      await registry.activate("contrib");

      const contributions = registry.getContributions("adapter");
      expect(contributions.length).toBe(1);
      expect(contributions[0].type).toBe("adapter");
    });
  });

  describe("capabilities", () => {
    it("checks plugin capabilities", () => {
      const manifest = createMockManifest({
        id: "cap",
        capabilities: { readDesign: true, generateFiles: true, modifyTokens: false, network: false, storage: false },
      });
      registry.register(manifest, createMockAPI());

      expect(registry.checkCapability("cap", "readDesign")).toBe(true);
      expect(registry.checkCapability("cap", "network")).toBe(false);
    });

    it("returns false for non-existent plugin", () => {
      expect(registry.checkCapability("ghost", "readDesign")).toBe(false);
    });
  });

  describe("events", () => {
    it("emits registration event", () => {
      const events: PluginEvent[] = [];
      registry.on(e => events.push(e));

      registry.register(createMockManifest({ id: "evt" }), createMockAPI());
      expect(events[0].type).toBe("plugin:registered");
    });

    it("emits activation event", async () => {
      const events: PluginEvent[] = [];
      registry.register(createMockManifest({ id: "evt2" }), createMockAPI());
      registry.on(e => events.push(e));

      await registry.activate("evt2");
      expect(events.some(e => e.type === "plugin:activated")).toBe(true);
    });

    it("allows unsubscribing", () => {
      const events: PluginEvent[] = [];
      const unsub = registry.on(e => events.push(e));
      unsub();

      registry.register(createMockManifest(), createMockAPI());
      expect(events.length).toBe(0);
    });
  });

  describe("manifest validation", () => {
    it("validates complete manifest", () => {
      const errors = registry.validateManifest(createMockManifest());
      expect(errors.length).toBe(0);
    });

    it("catches multiple errors", () => {
      const errors = registry.validateManifest({
        id: "",
        name: "",
        version: "bad",
        author: "",
        description: "",
        extensionPoint: "invalid" as never,
        capabilities: { readDesign: false, generateFiles: false, modifyTokens: false, network: false, storage: false },
        entryPoint: "",
      });
      expect(errors.length).toBeGreaterThan(3);
    });
  });
});

describe("Plugin Helpers", () => {
  it("createAdapterPlugin produces valid manifest + api", () => {
    const { manifest, api } = createAdapterPlugin({
      id: "flutter-adapter",
      name: "Flutter Adapter",
      frameworkId: "flutter",
      frameworkName: "Flutter",
      author: "DesignReady",
      generate: () => ({ files: [{ path: "widget.dart", content: "class MyWidget {}" }] }),
    });

    expect(manifest.extensionPoint).toBe("adapter");
    expect(manifest.capabilities.readDesign).toBe(true);

    const contribution = api.contribute();
    expect(contribution.type).toBe("adapter");
  });

  it("createAnalyzerPlugin produces valid manifest + api", () => {
    const { manifest, api } = createAnalyzerPlugin({
      id: "a11y-analyzer",
      name: "Accessibility Analyzer",
      author: "DesignReady",
      analyze: () => ({ score: 85, issues: ["Low contrast"], suggestions: ["Increase contrast ratio"] }),
    });

    expect(manifest.extensionPoint).toBe("analyzer");
    const contribution = api.contribute();
    expect(contribution.type).toBe("analyzer");
  });
});
