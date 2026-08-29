/**
 * AuditEngine — orchestration tests: rule selection, parallel run,
 * timeout protection, error isolation, maxNodes guard.
 */

import { describe, it, expect } from "vitest";
import { AuditEngine } from "../index.js";
import type { A11yRule, AuditInput, AuditNode } from "../types.js";

function node(overrides: Partial<AuditNode> = {}): AuditNode {
  return { id: "n1", name: "Node", type: "FRAME", ...overrides };
}

const passRule: A11yRule = {
  id: "test.pass",
  wcagCriterion: "1.1.1",
  wcagLevel: "A",
  category: "semantic",
  description: "always passes",
  evaluate: () => ({ issues: [] }),
};

const failRule: A11yRule = {
  id: "test.fail",
  wcagCriterion: "1.4.3",
  wcagLevel: "AA",
  category: "contrast",
  description: "always emits one issue",
  evaluate: (input: AuditInput) => ({
    issues: [
      {
        id: "x",
        ruleId: "test.fail",
        wcagCriterion: "1.4.3",
        category: "contrast" as const,
        severity: "serious" as const,
        nodeId: input.nodes[0]?.id ?? "?",
        nodeName: "n",
        nodeType: "TEXT",
        message: "fail",
      },
    ],
  }),
};

const throwRule: A11yRule = {
  id: "test.throw",
  wcagCriterion: "9.9.9",
  wcagLevel: "A",
  category: "aria",
  description: "throws",
  evaluate: () => {
    throw new Error("boom");
  },
};

const baseInput: AuditInput = {
  nodes: [node()],
  options: { wcagVersion: "2.2", wcagLevel: "AA" },
};

describe("AuditEngine.run", () => {
  it("returns score 100 when all rules pass", async () => {
    const engine = new AuditEngine([passRule]);
    const result = await engine.run(baseInput);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("aggregates issues and lowers score when a rule fails", async () => {
    const engine = new AuditEngine([passRule, failRule]);
    const result = await engine.run(baseInput);
    expect(result.issues).toHaveLength(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(100);
  });

  it("isolates a throwing rule — other rules still run", async () => {
    const engine = new AuditEngine([throwRule, failRule]);
    const result = await engine.run(baseInput);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].ruleId).toBe("test.fail");
  });

  it("respects rule selection via options.rules", async () => {
    const engine = new AuditEngine([passRule, failRule]);
    const result = await engine.run({
      ...baseInput,
      options: { ...baseInput.options, rules: ["test.pass"] },
    });
    expect(result.issues).toHaveLength(0);
  });

  it("runs all rules when options.rules is empty", async () => {
    const engine = new AuditEngine([failRule]);
    const result = await engine.run({
      ...baseInput,
      options: { ...baseInput.options, rules: [] },
    });
    expect(result.issues).toHaveLength(1);
  });

  it("populates metadata fields", async () => {
    const engine = new AuditEngine([passRule]);
    const result = await engine.run(baseInput);
    expect(result.wcagVersion).toBe("2.2");
    expect(result.wcagLevel).toBe("AA");
    expect(result.nodeCount).toBe(1);
    expect(typeof result.durationMs).toBe("number");
    expect(result.id).toBeTruthy();
  });

  it("defaults wcag version/level when omitted", async () => {
    const engine = new AuditEngine([passRule]);
    const result = await engine.run({ nodes: [node()], options: {} });
    expect(result.wcagVersion).toBe("2.2");
    expect(result.wcagLevel).toBe("AA");
  });

  it("throws when input exceeds maxNodes", async () => {
    const engine = new AuditEngine([passRule], { maxNodes: 2 });
    const nodes = [node({ id: "a" }), node({ id: "b" }), node({ id: "c" })];
    await expect(engine.run({ nodes, options: {} })).rejects.toThrow(/maxNodes/);
  });

  it("times out a hanging rule without failing the whole audit", async () => {
    const hangRule: A11yRule = {
      id: "test.hang",
      wcagCriterion: "1.1.1",
      wcagLevel: "A",
      category: "semantic",
      description: "never resolves",
      evaluate: () => new Promise(() => {}),
    };
    const engine = new AuditEngine([hangRule, failRule], { ruleTimeoutMs: 50 });
    const result = await engine.run(baseInput);
    expect(result.issues).toHaveLength(1);
  });
});
