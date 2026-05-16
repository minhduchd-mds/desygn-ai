/**
 * DesignSystemHub tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DesignSystemHub } from "../designSystemHub";
import type { DesignSystem, SystemTokens } from "../designSystemHub";

function createMockSystem(overrides: Partial<DesignSystem> = {}): DesignSystem {
  return {
    id: `sys-${Math.random().toString(36).slice(2, 6)}`,
    name: "Brand A",
    brand: "Brand A",
    figmaFileId: "figma-abc",
    description: "Primary brand design system",
    platform: "web",
    components: [
      { id: "btn-1", name: "Button", type: "atom", variants: 4, lastModified: Date.now() },
      { id: "card-1", name: "Card", type: "molecule", variants: 2, lastModified: Date.now() },
      { id: "nav-1", name: "Navbar", type: "organism", variants: 1, lastModified: Date.now() },
    ],
    tokens: {
      colors: [
        { name: "brand-primary", value: "#00d4ff", usageCount: 45, systems: ["Brand A"] },
        { name: "brand-secondary", value: "#7c3aed", usageCount: 20, systems: ["Brand A"] },
      ],
      spacings: [
        { name: "sm", value: "8px", usageCount: 30, systems: ["Brand A"] },
        { name: "md", value: "16px", usageCount: 25, systems: ["Brand A"] },
      ],
      typography: [],
      radii: [],
      shadows: [],
    },
    lastSynced: Date.now(),
    healthScore: 78,
    metadata: {
      componentCount: 3,
      tokenCount: 4,
      lastAudit: Date.now(),
      teamOwner: "design-team",
      version: "2.1.0",
    },
    ...overrides,
  };
}

describe("DesignSystemHub", () => {
  let hub: DesignSystemHub;

  beforeEach(() => {
    hub = new DesignSystemHub();
  });

  describe("system management", () => {
    it("adds a system", () => {
      const system = createMockSystem();
      hub.addSystem(system);
      expect(hub.getSystems().length).toBe(1);
    });

    it("removes a system", () => {
      const system = createMockSystem();
      hub.addSystem(system);
      expect(hub.removeSystem(system.id)).toBe(true);
      expect(hub.getSystems().length).toBe(0);
    });

    it("gets system by ID", () => {
      const system = createMockSystem({ name: "Test System" });
      hub.addSystem(system);
      expect(hub.getSystem(system.id)?.name).toBe("Test System");
    });

    it("updates components", () => {
      const system = createMockSystem();
      hub.addSystem(system);
      hub.updateComponents(system.id, [
        { id: "new-1", name: "NewComp", type: "atom", variants: 1, lastModified: Date.now() },
      ]);
      const updated = hub.getSystem(system.id)!;
      expect(updated.components.length).toBe(1);
      expect(updated.components[0].name).toBe("NewComp");
    });
  });

  describe("cross-system analysis", () => {
    it("computes consistency between systems", () => {
      hub.addSystem(createMockSystem({ id: "sys-1", name: "Brand A" }));
      hub.addSystem(createMockSystem({ id: "sys-2", name: "Brand B" }));

      const report = hub.analyzeCrossSystems();
      expect(report.consistency.overall).toBeGreaterThanOrEqual(0);
      expect(report.consistency.overall).toBeLessThanOrEqual(100);
    });

    it("finds duplicate components", () => {
      hub.addSystem(createMockSystem({
        id: "sys-1",
        name: "Brand A",
        components: [
          { id: "btn-a", name: "Button", type: "atom", variants: 3, lastModified: Date.now() },
        ],
      }));
      hub.addSystem(createMockSystem({
        id: "sys-2",
        name: "Brand B",
        components: [
          { id: "btn-b", name: "Button", type: "atom", variants: 4, lastModified: Date.now() },
        ],
      }));

      const report = hub.analyzeCrossSystems();
      expect(report.duplicates.length).toBeGreaterThan(0);
      expect(report.duplicates[0].componentName).toBe("Button");
      expect(report.duplicates[0].instances.length).toBe(2);
    });

    it("finds token conflicts", () => {
      hub.addSystem(createMockSystem({
        id: "sys-1",
        name: "Brand A",
        tokens: {
          colors: [{ name: "primary", value: "#00d4ff", usageCount: 10, systems: [] }],
          spacings: [], typography: [], radii: [], shadows: [],
        },
      }));
      hub.addSystem(createMockSystem({
        id: "sys-2",
        name: "Brand B",
        tokens: {
          colors: [{ name: "primary", value: "#ff0000", usageCount: 10, systems: [] }],
          spacings: [], typography: [], radii: [], shadows: [],
        },
      }));

      const report = hub.analyzeCrossSystems();
      expect(report.tokenConflicts.length).toBeGreaterThan(0);
      expect(report.tokenConflicts[0].tokenName).toBe("primary");
    });

    it("generates recommendations", () => {
      hub.addSystem(createMockSystem({ id: "sys-1", name: "Brand A" }));
      hub.addSystem(createMockSystem({ id: "sys-2", name: "Brand B" }));

      const report = hub.analyzeCrossSystems();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("shared components", () => {
    it("finds components shared across systems", () => {
      hub.addSystem(createMockSystem({
        id: "sys-1",
        components: [
          { id: "1", name: "Button", type: "atom", variants: 3, lastModified: Date.now() },
          { id: "2", name: "UniqueA", type: "atom", variants: 1, lastModified: Date.now() },
        ],
      }));
      hub.addSystem(createMockSystem({
        id: "sys-2",
        components: [
          { id: "3", name: "Button", type: "atom", variants: 4, lastModified: Date.now() },
          { id: "4", name: "UniqueB", type: "atom", variants: 1, lastModified: Date.now() },
        ],
      }));

      const shared = hub.findSharedComponents();
      expect(shared.has("button")).toBe(true);
      expect(shared.has("uniquea")).toBe(false);
    });
  });

  describe("unified tokens", () => {
    it("aggregates tokens across systems", () => {
      hub.addSystem(createMockSystem({
        id: "sys-1",
        name: "System Alpha",
        tokens: {
          colors: [
            { name: "blue", value: "#0000ff", usageCount: 10, systems: ["Alpha"] },
          ],
          spacings: [{ name: "sm", value: "8px", usageCount: 5, systems: ["Alpha"] }],
          typography: [], radii: [], shadows: [],
        },
      }));
      hub.addSystem(createMockSystem({
        id: "sys-2",
        name: "System Beta",
        tokens: {
          colors: [
            { name: "blue", value: "#0000ff", usageCount: 15, systems: ["Beta"] },
            { name: "red", value: "#ff0000", usageCount: 8, systems: ["Beta"] },
          ],
          spacings: [{ name: "sm", value: "8px", usageCount: 7, systems: ["Beta"] }],
          typography: [], radii: [], shadows: [],
        },
      }));

      const unified = hub.getUnifiedTokens();
      // Blue should be merged with combined usage
      const blue = unified.colors.find(c => c.value === "#0000ff");
      expect(blue).toBeDefined();
      expect(blue!.usageCount).toBe(25);
      expect(blue!.systems.length).toBe(2);
    });
  });

  describe("drift detection", () => {
    it("detects token drift", () => {
      hub.addSystem(createMockSystem({
        id: "sys-1",
        name: "Brand A",
        tokens: {
          colors: [{ name: "primary", value: "#ff0000", usageCount: 10, systems: [] }],
          spacings: [], typography: [], radii: [], shadows: [],
        },
      }));

      const sharedSpec: SystemTokens = {
        colors: [{ name: "primary", value: "#00d4ff", usageCount: 0, systems: [] }],
        spacings: [],
        typography: [],
        radii: [],
        shadows: [],
      };

      const report = hub.detectDrift("sys-1", sharedSpec);
      expect(report.drifts.length).toBeGreaterThan(0);
      expect(report.drifts[0].expected).toBe("#00d4ff");
      expect(report.drifts[0].actual).toBe("#ff0000");
    });

    it("reports healthy when no drift", () => {
      hub.addSystem(createMockSystem({
        id: "sys-1",
        tokens: {
          colors: [{ name: "primary", value: "#00d4ff", usageCount: 10, systems: [] }],
          spacings: [], typography: [], radii: [], shadows: [],
        },
      }));

      const sharedSpec: SystemTokens = {
        colors: [{ name: "primary", value: "#00d4ff", usageCount: 0, systems: [] }],
        spacings: [],
        typography: [],
        radii: [],
        shadows: [],
      };

      const report = hub.detectDrift("sys-1", sharedSpec);
      expect(report.severity).toBe("healthy");
    });

    it("stores drift history", () => {
      hub.addSystem(createMockSystem({ id: "sys-1" }));
      const spec: SystemTokens = { colors: [], spacings: [], typography: [], radii: [], shadows: [] };

      hub.detectDrift("sys-1", spec);
      hub.detectDrift("sys-1", spec);

      const history = hub.getDriftHistory("sys-1");
      expect(history.length).toBe(2);
    });
  });

  describe("hub statistics", () => {
    it("computes aggregate stats", () => {
      hub.addSystem(createMockSystem({ id: "sys-1", healthScore: 80 }));
      hub.addSystem(createMockSystem({ id: "sys-2", healthScore: 60 }));

      const stats = hub.getStats();
      expect(stats.totalSystems).toBe(2);
      expect(stats.totalComponents).toBe(6);
      expect(stats.averageHealth).toBe(70);
      expect(stats.sharedComponentCount).toBeGreaterThan(0);
    });
  });
});
