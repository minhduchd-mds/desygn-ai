/**
 * Tests for design-engine module.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DesignEngine, DESIGN_MD_TEMPLATES } from "../../design-engine";

describe("DesignEngine", () => {
  let engine: DesignEngine;

  beforeEach(() => {
    engine = new DesignEngine();
  });

  it("initializes with empty state", () => {
    const state = engine.getState();
    expect(state.context).toBeNull();
    expect(state.validationReport).toBeNull();
    expect(state.screens).toEqual([]);
    expect(state.designMd).toBeNull();
    expect(state.isProcessing).toBe(false);
  });

  it("generates Design.md from request with valid preset", () => {
    const mockPreset = {
      label: "Test Preset",
      direction: "Test direction",
      palette: ["#000", "#FFF"],
      typography: "Sans-serif",
      components: ["Button", "Card"],
      layout: ["Grid"],
      elevation: "Flat",
      tokens: ["spacing-4"],
      rules: ["Be consistent"],
      donts: ["Do not use inline styles"],
    };
    const result = engine.generate({
      request: {
        projectName: "Test Project",
        category: "SaaS",
        style: "Modern",
        openDesign: "testPreset",
        layout: "Dashboard",
        target: "React",
        prompt: "Build a dashboard",
      },
      userPlan: "free",
      presets: { testPreset: mockPreset },
    });
    expect(result).toContain("Test Project");
    expect(engine.getState().designMd).toBe(result);
  });

  it("infers project name from content", () => {
    const name = engine.inferName("# My Dashboard App\nSome content here");
    expect(name).toBeTruthy();
  });

  it("resets state", () => {
    const mockPreset = {
      label: "X Preset",
      direction: "d",
      palette: ["#000"],
      typography: "mono",
      components: ["Btn"],
      layout: ["Stack"],
      elevation: "None",
      tokens: ["t"],
      rules: ["r"],
      donts: ["d"],
    };
    engine.generate({
      request: {
        projectName: "X",
        category: "Y",
        style: "Z",
        openDesign: "xPreset",
        layout: "L",
        target: "T",
        prompt: "P",
      },
      userPlan: "free",
      presets: { xPreset: mockPreset },
    });
    engine.reset();
    expect(engine.getState().designMd).toBeNull();
  });
});

describe("DESIGN_MD_TEMPLATES", () => {
  it("has templates loaded", () => {
    expect(DESIGN_MD_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("each template has required fields", () => {
    for (const template of DESIGN_MD_TEMPLATES.slice(0, 5)) {
      expect(template.id).toBeTruthy();
      expect(template.label).toBeTruthy();
      expect(template.category).toBeTruthy();
    }
  });
});

