/**
 * DesignAnalyzer tests.
 *
 * Verifies design system auditing, pattern detection,
 * recommendations, and debt estimation.
 */

import { describe, it, expect } from "vitest";
import { DesignAnalyzer } from "../designAnalyzer";
import type { ScanResult } from "../../../../shared/types";

// ── Mock Data ─────────────────────────────────────────────────

function createMockScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    componentName: "Button",
    overallScore: 72,
    namingScore: 0.8,
    structureScore: 0.7,
    tokensScore: 0.6,
    metaScore: 0.5,
    completenessScore: 0.7,
    variantsScore: 0.6,
    issues: [],
    variants: [],
    tokenCoverage: 0.6,
    componentDescription: "A button component",
    ...overrides,
  } as unknown as ScanResult;
}

function createMockNode(overrides = {}) {
  return {
    id: "node-1",
    name: "Button",
    type: "COMPONENT",
    width: 120,
    height: 48,
    layoutMode: "HORIZONTAL" as const,
    itemSpacing: 8,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    fills: [{ type: "SOLID", color: { r: 0, g: 0.83, b: 1 } }],
    fontName: { family: "Inter", style: "Medium" },
    fontSize: 14,
    children: [],
    ...overrides,
  };
}

describe("DesignAnalyzer", () => {
  const analyzer = new DesignAnalyzer();

  describe("analyze", () => {
    it("returns a complete report", () => {
      const results = [createMockScanResult()];
      const report = analyzer.analyze(results);

      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
      expect(report.dimensions.length).toBeGreaterThan(0);
      expect(report.metrics).toBeDefined();
      expect(report.tokenAnalysis).toBeDefined();
      expect(report.accessibility).toBeDefined();
      expect(report.debtEstimate).toBeDefined();
    });

    it("calculates correct grade", () => {
      const goodResults = [
        createMockScanResult({
          overallScore: 95,
          issues: [],
          variants: [{ name: "mobile", width: 375 }] as unknown[],
          tokenCoverage: 0.9,
          componentDescription: "Well documented button",
        }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(goodResults);
      expect(report.score).toBeGreaterThanOrEqual(60);
    });

    it("detects low scores and generates recommendations", () => {
      const badResults = [
        createMockScanResult({
          componentName: "btn-primary",
          issues: [
            { category: "naming", message: "Non-standard name", severity: "error" },
            { category: "naming", message: "Inconsistent casing", severity: "error" },
            { category: "naming", message: "Missing prefix", severity: "warning" },
            { category: "tokens", message: "Hardcoded color", severity: "error" },
            { category: "tokens", message: "Hardcoded spacing", severity: "error" },
            { category: "tokens", message: "Hardcoded font", severity: "warning" },
            { category: "structure", message: "Too deep", severity: "error" },
            { category: "structure", message: "Missing auto-layout", severity: "error" },
          ],
          tokenCoverage: 0.1,
          variants: [],
          componentDescription: "",
        }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(badResults);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.grade).not.toBe("A");
    });
  });

  describe("dimensions scoring", () => {
    it("scores consistency dimension", () => {
      const results = [
        createMockScanResult({
          issues: [
            { category: "structure", message: "Inconsistent padding", severity: "error" },
          ],
        }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const consistency = report.dimensions.find(d => d.name === "Consistency");
      expect(consistency).toBeDefined();
      expect(consistency!.score).toBeLessThan(100);
    });

    it("scores completeness dimension", () => {
      const results = [
        createMockScanResult({ variants: [], tokenCoverage: 0.3 }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const completeness = report.dimensions.find(d => d.name === "Completeness");
      expect(completeness).toBeDefined();
    });

    it("scores documentation dimension", () => {
      const results = [
        createMockScanResult({ componentDescription: "", metaScore: 0.1 }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const docs = report.dimensions.find(d => d.name === "Documentation");
      expect(docs).toBeDefined();
      expect(docs!.score).toBeLessThan(50);
    });
  });

  describe("pattern detection", () => {
    it("detects naming convention patterns", () => {
      const results = [
        createMockScanResult({ componentName: "ButtonPrimary" }),
        createMockScanResult({ componentName: "button-secondary" }),
        createMockScanResult({ componentName: "CardHeader" }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const namingPattern = report.patterns.find(p => p.type === "naming-convention");
      expect(namingPattern).toBeDefined();
    });

    it("detects variant consolidation opportunities", () => {
      const results = [
        createMockScanResult({ componentName: "ButtonPrimary" }),
        createMockScanResult({ componentName: "ButtonSecondary" }),
        createMockScanResult({ componentName: "ButtonTertiary" }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const variantPattern = report.patterns.find(p => p.type === "component-variant");
      expect(variantPattern).toBeDefined();
      expect(variantPattern!.components.length).toBe(3);
    });

    it("detects repeated layouts with nodes", () => {
      const nodes = [
        createMockNode({ name: "Card1", layoutMode: "VERTICAL", itemSpacing: 16, paddingTop: 20, children: [] }),
        createMockNode({ name: "Card2", layoutMode: "VERTICAL", itemSpacing: 16, paddingTop: 20, children: [] }),
        createMockNode({ name: "Card3", layoutMode: "VERTICAL", itemSpacing: 16, paddingTop: 20, children: [] }),
      ];

      const report = analyzer.analyze([], nodes as unknown[]);
      const layoutPattern = report.patterns.find(p => p.type === "repeated-layout");
      expect(layoutPattern).toBeDefined();
      expect(layoutPattern!.occurrences).toBeGreaterThanOrEqual(3);
    });
  });

  describe("metrics computation", () => {
    it("computes correct metrics from results", () => {
      const results = [
        createMockScanResult({ tokenCoverage: 0.8, variants: [{ name: "mobile" }] }),
        createMockScanResult({ tokenCoverage: 0.6, variants: [] }),
        createMockScanResult({ tokenCoverage: 0.4, variants: [{ name: "tablet" }] }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      expect(report.metrics.totalComponents).toBe(3);
      expect(report.metrics.tokenCoverage).toBeGreaterThan(0);
      expect(report.metrics.variantCoverage).toBeGreaterThan(0);
    });
  });

  describe("accessibility analysis", () => {
    it("flags small touch targets", () => {
      const nodes = [
        createMockNode({ type: "COMPONENT", width: 24, height: 24, name: "SmallIcon" }),
        createMockNode({ type: "COMPONENT", width: 48, height: 48, name: "LargeButton" }),
      ];

      const report = analyzer.analyze([], nodes as unknown[]);
      expect(report.accessibility.touchTargets.fail).toBeGreaterThan(0);
      expect(report.accessibility.touchTargets.pass).toBeGreaterThan(0);
    });

    it("flags small text sizes", () => {
      const nodes = [
        createMockNode({ fontSize: 10, type: "TEXT" }),
        createMockNode({ fontSize: 16, type: "TEXT" }),
      ];

      const report = analyzer.analyze([], nodes as unknown[]);
      expect(report.accessibility.textSizing.fail).toBeGreaterThan(0);
      expect(report.accessibility.textSizing.pass).toBeGreaterThan(0);
    });
  });

  describe("recommendations", () => {
    it("recommends token coverage improvement when low", () => {
      const results = [
        createMockScanResult({ tokenCoverage: 0.2 }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const tokenRec = report.recommendations.find(r => r.id === "rec-token-coverage");
      expect(tokenRec).toBeDefined();
      expect(tokenRec!.priority).toBe("critical");
    });

    it("recommends variant coverage when low", () => {
      const results = [
        createMockScanResult({ variants: [] }),
        createMockScanResult({ variants: [] }),
        createMockScanResult({ variants: [] }),
        createMockScanResult({ variants: [{ name: "mobile" }] }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      const variantRec = report.recommendations.find(r => r.id === "rec-variant-coverage");
      expect(variantRec).toBeDefined();
    });

    it("sorts recommendations by priority", () => {
      const results = [
        createMockScanResult({
          issues: Array(20).fill({ category: "naming", message: "Bad", severity: "error" }),
          tokenCoverage: 0.1,
          variants: [],
          componentDescription: "",
        }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      if (report.recommendations.length >= 2) {
        const priorities = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < report.recommendations.length; i++) {
          expect(priorities[report.recommendations[i].priority])
            .toBeGreaterThanOrEqual(priorities[report.recommendations[i - 1].priority]);
        }
      }
    });
  });

  describe("design debt estimation", () => {
    it("estimates debt based on recommendations", () => {
      const results = [
        createMockScanResult({
          issues: Array(15).fill({ category: "tokens", message: "Hardcoded", severity: "error" }),
          tokenCoverage: 0.1,
          variants: [],
        }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      expect(report.debtEstimate.estimatedHours).toBeGreaterThan(0);
      expect(report.debtEstimate.costEstimate).toMatch(/^\$/);
      expect(report.debtEstimate.categories.length).toBeGreaterThan(0);
    });

    it("zero debt for perfect design system", () => {
      const results = [
        createMockScanResult({
          issues: [],
          tokenCoverage: 0.95,
          variants: [{ name: "mobile" }, { name: "desktop" }],
          componentDescription: "Well documented",
          metaScore: 0.9,
        }),
      ] as unknown as ScanResult[];

      const report = analyzer.analyze(results);
      // With no issues and high coverage, debt should be low
      expect(report.debtEstimate.estimatedHours).toBeLessThan(50);
    });
  });
});
