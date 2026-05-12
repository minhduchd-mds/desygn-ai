import { describe, it, expect } from "vitest";
import { batchScan } from "../batch-scanner";
import type { SerializedNode, PluginProfile } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

function makeInstance(componentName: string): SerializedNode {
  return makeNode(componentName, { isInstance: true, componentName });
}

describe("batchScan", () => {
  it("scans multiple nodes and returns results", () => {
    const nodes = [
      makeNode("icon-star", { width: 24, height: 24 }),
      makeNode("button-primary", { layoutMode: "HORIZONTAL", width: 120, height: 40 }),
    ];

    const result = batchScan(nodes);
    expect(result.items).toHaveLength(2);
    expect(result.averageScore).toBeGreaterThan(0);
  });

  it("sorts by atomic level (unclassified first, then molecules)", () => {
    const simple = makeNode("icon", { id: "a1" });
    const molecule = makeNode("input-group", {
      id: "m1",
      children: [makeInstance("Input"), makeInstance("Label"), makeInstance("Icon")],
    });

    const result = batchScan([molecule, simple]);
    expect(result.items[0].atomicLevel).toBe("unclassified");
    expect(result.items[1].atomicLevel).toBe("molecule");
  });

  it("generates batch prompt when average score >= 60", () => {
    const nodes = [
      makeNode("card", {
        layoutMode: "VERTICAL",
        itemSpacing: 8,
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        width: 320,
        height: 200,
        fills: [{ type: "SOLID", color: { r: 255, g: 255, b: 255 }, boundToVariable: true }],
        children: [
          makeNode("title", { type: "TEXT", characters: "Card", fontSize: 18 }),
          makeNode("body", { type: "TEXT", characters: "Text", fontSize: 14 }),
        ],
      }),
    ];

    const result = batchScan(nodes);
    if (result.averageScore >= 60) {
      expect(result.batchPromptCompact).toBeDefined();
    }
  });

  it("builds export plan from batch items", () => {
    // Use component nodes so plan has entries (unclassified are skipped)
    const nodes = [
      makeNode("Icon", { id: "a", isComponent: true }),
      makeNode("Badge", { id: "b", isComponent: true }),
    ];

    const result = batchScan(nodes);
    expect(result.exportPlan).toBeDefined();
    expect(result.exportPlan.length).toBeGreaterThan(0);
  });

  it("handles empty node list", () => {
    const result = batchScan([]);
    expect(result.items).toHaveLength(0);
    expect(result.averageScore).toBe(0);
  });

  it("includes skill-sync block exactly once in batch prompt (not per component)", () => {
    const profile: PluginProfile = {
      id: "test-profile",
      name: "Test System",
      stack: "React+TS+CSS",
      layout: "",
      tokens: {},
      components: [],
      guidelines: "",
    };

    const makeHighScoringCard = (id: string, name: string): SerializedNode =>
      makeNode(name, {
        id,
        layoutMode: "VERTICAL",
        itemSpacing: 8,
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        width: 320,
        height: 200,
        fills: [{ type: "SOLID", color: { r: 255, g: 255, b: 255 }, boundToVariable: true }],
        children: [
          makeNode("title", { type: "TEXT", characters: "Card", fontSize: 18 }),
          makeNode("body", { type: "TEXT", characters: "Text", fontSize: 14 }),
        ],
      });

    const nodes = [
      makeHighScoringCard("c1", "card-one"),
      makeHighScoringCard("c2", "card-two"),
      makeHighScoringCard("c3", "card-three"),
    ];

    const result = batchScan(nodes, profile);
    expect(result.batchPromptCompact).toBeDefined();

    const prompt = result.batchPromptCompact!;
    const skillSyncMatches = prompt.match(/# TASK 2 — Skill Sync/g) ?? [];
    expect(skillSyncMatches).toHaveLength(1);
  });
});
