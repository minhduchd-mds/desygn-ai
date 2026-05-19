import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TestGenAgent } from "../self-improve/TestGenAgent";
import type { AgentContextV6 } from "../BaseAgent";

const TEST_ROOT = join(tmpdir(), `desygn-testgen-${Date.now()}`);

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1",
    projectId: "p1",
    costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("TestGenAgent", () => {
  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    await writeFile(
      join(TEST_ROOT, "utils.ts"),
      [
        "export function add(a: number, b: number): number {",
        "  return a + b;",
        "}",
        "",
        "export const PI = 3.14;",
        "",
        "export class Counter {",
        "  count = 0;",
        "}",
        "",
      ].join("\n"),
    );
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("extracts named exports from a source file", async () => {
    const agent = new TestGenAgent(TEST_ROOT);
    const result = await agent.execute({ sourceFile: "utils.ts" }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.output!.exports).toContain("add");
    expect(result.output!.exports).toContain("PI");
    expect(result.output!.exports).toContain("Counter");
  });

  it("generates a test scaffold that imports the source", async () => {
    const agent = new TestGenAgent(TEST_ROOT);
    const result = await agent.execute({ sourceFile: "utils.ts" }, makeCtx());
    expect(result.output!.content).toContain('import { add, PI, Counter }');
    expect(result.output!.content).toContain('from "../utils"');
    expect(result.output!.content).toContain('describe("utils"');
  });

  it("places the test file in __tests__ directory by default", async () => {
    const agent = new TestGenAgent(TEST_ROOT);
    const result = await agent.execute({ sourceFile: "utils.ts" }, makeCtx());
    expect(result.output!.testFile).toContain("__tests__");
    expect(result.output!.testFile).toContain("utils.test.ts");
  });

  it("falls back to wildcard import when no named exports", async () => {
    await writeFile(join(TEST_ROOT, "emptyExports.ts"), `const x = 1;\nconsole.log(x);\n`);
    const agent = new TestGenAgent(TEST_ROOT);
    const result = await agent.execute({ sourceFile: "emptyExports.ts" }, makeCtx());
    expect(result.output!.content).toContain("import * as emptyExports");
  });

  it("marks the generated file in filesModified", async () => {
    const agent = new TestGenAgent(TEST_ROOT);
    const result = await agent.execute({ sourceFile: "utils.ts" }, makeCtx());
    expect(result.filesModified).toBeDefined();
    expect(result.filesModified!.length).toBe(1);
  });
});
