/**
 * Mobile Support tests.
 */

import { describe, it, expect } from "vitest";
import {
  classifyViewport,
  getBreakpoint,
  analyzeTouchTargets,
  analyzeResponsive,
  getPlatformHints,
  checkPerformanceBudget,
  DEFAULT_BREAKPOINTS,
  PERFORMANCE_BUDGETS,
} from "../mobileSupport";
import type { InteractiveNode } from "../mobileSupport";

describe("Viewport Classification", () => {
  it("classifies mobile (< 600)", () => {
    expect(classifyViewport(375)).toBe("mobile");
    expect(classifyViewport(320)).toBe("mobile");
    expect(classifyViewport(599)).toBe("mobile");
  });

  it("classifies tablet (600-1023)", () => {
    expect(classifyViewport(600)).toBe("tablet");
    expect(classifyViewport(768)).toBe("tablet");
    expect(classifyViewport(1023)).toBe("tablet");
  });

  it("classifies desktop (1024-2559)", () => {
    expect(classifyViewport(1024)).toBe("desktop");
    expect(classifyViewport(1440)).toBe("desktop");
  });

  it("classifies tv (2560+)", () => {
    expect(classifyViewport(2560)).toBe("tv");
    expect(classifyViewport(3840)).toBe("tv");
  });

  it("getBreakpoint returns correct breakpoint", () => {
    const bp = getBreakpoint(375);
    expect(bp.name).toBe("mobile-m");
    expect(bp.class).toBe("mobile");
  });

  it("DEFAULT_BREAKPOINTS covers full range", () => {
    expect(DEFAULT_BREAKPOINTS.length).toBe(7);
    expect(DEFAULT_BREAKPOINTS[0].minWidth).toBe(320);
  });
});

describe("Touch Target Analysis", () => {
  const mockNodes: InteractiveNode[] = [
    { id: "1", name: "Big Button", width: 48, height: 48, type: "INSTANCE" },
    { id: "2", name: "Small Link", width: 20, height: 16, type: "TEXT" },
    { id: "3", name: "Medium Btn", width: 32, height: 32, type: "INSTANCE" },
  ];

  it("validates touch targets", () => {
    const results = analyzeTouchTargets(mockNodes);
    expect(results.length).toBe(3);
  });

  it("passes 48x48 target (meets both)", () => {
    const results = analyzeTouchTargets(mockNodes);
    const big = results.find(r => r.nodeId === "1")!;
    expect(big.meets24px).toBe(true);
    expect(big.meets44px).toBe(true);
    expect(big.issue).toBeUndefined();
  });

  it("fails 20x16 target (below 24px minimum)", () => {
    const results = analyzeTouchTargets(mockNodes);
    const small = results.find(r => r.nodeId === "2")!;
    expect(small.meets24px).toBe(false);
    expect(small.meets44px).toBe(false);
    expect(small.issue).toContain("WCAG 2.2 minimum");
  });

  it("warns 32x32 target (meets 24px, below 44px)", () => {
    const results = analyzeTouchTargets(mockNodes);
    const medium = results.find(r => r.nodeId === "3")!;
    expect(medium.meets24px).toBe(true);
    expect(medium.meets44px).toBe(false);
    expect(medium.issue).toContain("recommended size");
  });
});

describe("Responsive Analysis", () => {
  const nodes: InteractiveNode[] = [
    { id: "1", name: "Button", width: 48, height: 48, type: "INSTANCE" },
    { id: "2", name: "Link", width: 16, height: 12, type: "TEXT" },
  ];

  it("analyzes mobile design", () => {
    const result = analyzeResponsive(375, nodes);
    expect(result.viewportClass).toBe("mobile");
    expect(result.touchTargets.length).toBe(2);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("flags critical touch target issues", () => {
    const result = analyzeResponsive(375, nodes);
    const critical = result.issues.find(i => i.severity === "critical");
    expect(critical).toBeDefined();
    expect(critical!.message).toContain("minimum touch target");
  });

  it("provides platform-specific recommendations", () => {
    const result = analyzeResponsive(375, nodes, { targetPlatforms: ["ios", "android"] });
    expect(result.recommendations.some(r => r.includes("safe area"))).toBe(true);
    expect(result.recommendations.some(r => r.includes("Material"))).toBe(true);
  });

  it("warns about wide mobile design", () => {
    const result = analyzeResponsive(500, []);
    const issue = result.issues.find(i => i.id === "viewport-wide");
    expect(issue).toBeDefined();
  });

  it("calculates responsive score", () => {
    const result = analyzeResponsive(375, nodes);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles empty nodes", () => {
    const result = analyzeResponsive(1024, []);
    expect(result.viewportClass).toBe("desktop");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("Platform Hints", () => {
  it("provides iOS hints", () => {
    const hints = getPlatformHints("ios");
    expect(hints.safeAreaInsets).toBe(true);
    expect(hints.navigationPattern).toBe("tab-bar");
    expect(hints.specificNotes.length).toBeGreaterThan(0);
  });

  it("provides Android hints", () => {
    const hints = getPlatformHints("android");
    expect(hints.navigationPattern).toBe("bottom-nav");
    expect(hints.gestureHints).toContain("swipe");
  });

  it("provides PWA hints", () => {
    const hints = getPlatformHints("pwa");
    expect(hints.specificNotes.some(n => n.includes("service worker"))).toBe(true);
  });

  it("provides React Native hints", () => {
    const hints = getPlatformHints("react-native");
    expect(hints.specificNotes.some(n => n.includes("SafeAreaView"))).toBe(true);
  });

  it("provides Flutter hints", () => {
    const hints = getPlatformHints("flutter");
    expect(hints.specificNotes.some(n => n.includes("SafeArea widget"))).toBe(true);
  });

  it("provides responsive-web hints as default", () => {
    const hints = getPlatformHints("responsive-web");
    expect(hints.specificNotes.some(n => n.includes("container queries"))).toBe(true);
  });
});

describe("Performance Budget", () => {
  it("passes within budget", () => {
    const result = checkPerformanceBudget("mobile", {
      maxBundleSizeKb: 100,
      targetFCP: 1500,
    });
    expect(result.passes).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it("fails exceeding bundle size", () => {
    const result = checkPerformanceBudget("mobile", {
      maxBundleSizeKb: 500,
    });
    expect(result.passes).toBe(false);
    expect(result.violations[0]).toContain("Bundle size");
  });

  it("fails exceeding FCP", () => {
    const result = checkPerformanceBudget("mobile", {
      targetFCP: 3000,
    });
    expect(result.passes).toBe(false);
    expect(result.violations[0]).toContain("FCP");
  });

  it("desktop has higher budgets than mobile", () => {
    expect(PERFORMANCE_BUDGETS.desktop.maxBundleSizeKb).toBeGreaterThan(
      PERFORMANCE_BUDGETS.mobile.maxBundleSizeKb,
    );
  });

  it("checks multiple violations", () => {
    const result = checkPerformanceBudget("mobile", {
      maxBundleSizeKb: 999,
      maxImageSizeKb: 999,
      maxFontCount: 10,
    });
    expect(result.violations.length).toBe(3);
  });
});
