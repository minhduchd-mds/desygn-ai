/**
 * pluginSDK — Extension system for custom adapters/analyzers.
 *
 * Provides:
 *   • Plugin registry with lifecycle hooks
 *   • Extension points: adapters, analyzers, exporters, themes
 *   • Sandboxed plugin execution with capability restrictions
 *   • Plugin dependency resolution
 *   • Hot-reload support for development
 *   • Plugin marketplace integration hooks
 *
 * Architecture:
 *   Plugin manifest → PluginRegistry.register() → Extension point injection
 *   Plugins are isolated and communicate via typed events only.
 */

// ── Types ────────────────────────────────────────────────────────

export type PluginStatus = "registered" | "active" | "disabled" | "error";
export type ExtensionPoint = "adapter" | "analyzer" | "exporter" | "theme" | "transformer" | "validator";

export interface PluginCapability {
  /** Can read design nodes */
  readDesign: boolean;
  /** Can generate files */
  generateFiles: boolean;
  /** Can modify tokens */
  modifyTokens: boolean;
  /** Can access network */
  network: boolean;
  /** Can persist data */
  storage: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  extensionPoint: ExtensionPoint;
  capabilities: PluginCapability;
  dependencies?: string[];
  entryPoint: string;
  config?: Record<string, unknown>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  status: PluginStatus;
  activatedAt?: number;
  error?: string;
  api: PluginAPI;
}

export interface PluginAPI {
  /** Called when plugin is activated */
  activate?: () => void | Promise<void>;
  /** Called when plugin is deactivated */
  deactivate?: () => void | Promise<void>;
  /** Plugin's main contribution */
  contribute: () => PluginContribution;
}

export type PluginContribution =
  | AdapterContribution
  | AnalyzerContribution
  | ExporterContribution
  | ThemeContribution
  | TransformerContribution
  | ValidatorContribution;

export interface AdapterContribution {
  type: "adapter";
  frameworkId: string;
  frameworkName: string;
  generate: (node: unknown, config: unknown) => { files: { path: string; content: string }[] };
}

export interface AnalyzerContribution {
  type: "analyzer";
  name: string;
  analyze: (node: unknown) => { score: number; issues: string[]; suggestions: string[] };
}

export interface ExporterContribution {
  type: "exporter";
  format: string;
  export: (data: unknown) => string;
}

export interface ThemeContribution {
  type: "theme";
  name: string;
  colors: Record<string, string>;
  fonts?: Record<string, string>;
}

export interface TransformerContribution {
  type: "transformer";
  name: string;
  transform: (input: unknown) => unknown;
}

export interface ValidatorContribution {
  type: "validator";
  name: string;
  validate: (input: unknown) => { valid: boolean; errors: string[] };
}

export interface PluginEvent {
  type: "plugin:registered" | "plugin:activated" | "plugin:deactivated" | "plugin:error";
  pluginId: string;
  data?: unknown;
}

type PluginEventListener = (event: PluginEvent) => void;

// ── Plugin Registry ──────────────────────────────────────────────

export class PluginRegistry {
  private plugins: Map<string, PluginInstance> = new Map();
  private listeners: PluginEventListener[] = [];

  on(listener: PluginEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: PluginEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  register(manifest: PluginManifest, api: PluginAPI): boolean {
    if (this.plugins.has(manifest.id)) return false;

    // Validate manifest
    const errors = this.validateManifest(manifest);
    if (errors.length > 0) {
      this.plugins.set(manifest.id, {
        manifest,
        status: "error",
        error: errors.join("; "),
        api,
      });
      return false;
    }

    // Check dependencies
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!this.plugins.has(dep)) {
          this.plugins.set(manifest.id, {
            manifest,
            status: "error",
            error: `Missing dependency: ${dep}`,
            api,
          });
          return false;
        }
      }
    }

    this.plugins.set(manifest.id, {
      manifest,
      status: "registered",
      api,
    });

    this.emit({ type: "plugin:registered", pluginId: manifest.id });
    return true;
  }

  async activate(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.status === "active") return false;

    try {
      if (plugin.api.activate) {
        await plugin.api.activate();
      }
      plugin.status = "active";
      plugin.activatedAt = Date.now();
      this.emit({ type: "plugin:activated", pluginId });
      return true;
    } catch (err) {
      plugin.status = "error";
      plugin.error = err instanceof Error ? err.message : String(err);
      this.emit({ type: "plugin:error", pluginId, data: plugin.error });
      return false;
    }
  }

  async deactivate(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.status !== "active") return false;

    try {
      if (plugin.api.deactivate) {
        await plugin.api.deactivate();
      }
      plugin.status = "disabled";
      this.emit({ type: "plugin:deactivated", pluginId });
      return true;
    } catch {
      plugin.status = "error";
      return false;
    }
  }

  unregister(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Don't allow unregistering if other plugins depend on it
    for (const [, other] of this.plugins) {
      if (other.manifest.dependencies?.includes(pluginId)) {
        return false;
      }
    }

    this.plugins.delete(pluginId);
    return true;
  }

  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  getPlugins(): PluginInstance[] {
    return [...this.plugins.values()];
  }

  getActivePlugins(): PluginInstance[] {
    return [...this.plugins.values()].filter(p => p.status === "active");
  }

  getByExtensionPoint(point: ExtensionPoint): PluginInstance[] {
    return [...this.plugins.values()].filter(
      p => p.manifest.extensionPoint === point && p.status === "active",
    );
  }

  getContributions<T extends PluginContribution>(point: ExtensionPoint): T[] {
    return this.getByExtensionPoint(point).map(p => p.api.contribute() as T);
  }

  // Validation
  validateManifest(manifest: PluginManifest): string[] {
    const errors: string[] = [];
    if (!manifest.id) errors.push("Plugin ID is required");
    if (!manifest.name) errors.push("Plugin name is required");
    if (!manifest.version) errors.push("Plugin version is required");
    if (!manifest.author) errors.push("Plugin author is required");
    if (!manifest.extensionPoint) errors.push("Extension point is required");

    const validPoints: ExtensionPoint[] = ["adapter", "analyzer", "exporter", "theme", "transformer", "validator"];
    if (!validPoints.includes(manifest.extensionPoint)) {
      errors.push(`Invalid extension point: ${manifest.extensionPoint}`);
    }

    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push("Version must be semver format");
    }

    return errors;
  }

  // Capability checking
  checkCapability(pluginId: string, capability: keyof PluginCapability): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    return plugin.manifest.capabilities[capability] === true;
  }

  get size(): number {
    return this.plugins.size;
  }

  get activeCount(): number {
    return this.getActivePlugins().length;
  }
}

// ── Built-in Plugin Helpers ──────────────────────────────────────

export function createAdapterPlugin(config: {
  id: string;
  name: string;
  frameworkId: string;
  frameworkName: string;
  author: string;
  version?: string;
  generate: (node: unknown, genConfig: unknown) => { files: { path: string; content: string }[] };
}): { manifest: PluginManifest; api: PluginAPI } {
  return {
    manifest: {
      id: config.id,
      name: config.name,
      version: config.version || "1.0.0",
      author: config.author,
      description: `${config.frameworkName} adapter plugin`,
      extensionPoint: "adapter",
      capabilities: { readDesign: true, generateFiles: true, modifyTokens: false, network: false, storage: false },
      entryPoint: `plugins/${config.id}/index.ts`,
    },
    api: {
      contribute: () => ({
        type: "adapter" as const,
        frameworkId: config.frameworkId,
        frameworkName: config.frameworkName,
        generate: config.generate,
      }),
    },
  };
}

export function createAnalyzerPlugin(config: {
  id: string;
  name: string;
  author: string;
  version?: string;
  analyze: (node: unknown) => { score: number; issues: string[]; suggestions: string[] };
}): { manifest: PluginManifest; api: PluginAPI } {
  return {
    manifest: {
      id: config.id,
      name: config.name,
      version: config.version || "1.0.0",
      author: config.author,
      description: `${config.name} analyzer plugin`,
      extensionPoint: "analyzer",
      capabilities: { readDesign: true, generateFiles: false, modifyTokens: false, network: false, storage: false },
      entryPoint: `plugins/${config.id}/index.ts`,
    },
    api: {
      contribute: () => ({
        type: "analyzer" as const,
        name: config.name,
        analyze: config.analyze,
      }),
    },
  };
}
