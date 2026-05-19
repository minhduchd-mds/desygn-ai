import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SelfDiagnosticAgent } from "../self-improve/SelfDiagnosticAgent";
import type { AgentContextV6 } from "../BaseAgent";

const TEST_ROOT = join(tmpdir(), `desygn-test-${Date.now()}`);
const SRC_DIR = join(TEST_ROOT, "src");

function makeCtx(): AgentContextV6 {
  return {
    runId: "diag-test",
    projectId: "p1",
    costBudgetUsd: 1,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe("SelfDiagnosticAgent", () => {
  beforeAll(async () => {
    await mkdir(SRC_DIR, { recursive: true });

    await writeFile(
      join(SRC_DIR, "todo.ts"),
      `// TODO: implement this\nexport const x = 1;\n`,
    );
    await writeFile(
      join(SRC_DIR, "fixme.ts"),
      `// FIXME: broken logic\nexport const y: any = 2;\n`,
    );
    await writeFile(
      join(SRC_DIR, "disabled.ts"),
      `// eslint-disable-next-line\nexport const z: any = 3;\n`,
    );
    await writeFile(
      join(SRC_DIR, "clean.ts"),
      `export const ok: string = "ok";\n`,
    );
    await writeFile(
      join(SRC_DIR, "clean.test.ts"),
      `import { ok } from "./clean";\nexpect(ok).toBe("ok");\n`,
    );

    // Large file (501 lines)
    const bigContent = Array.from({ length: 501 }, (_, i) => `// line ${i}`).join("\n");
    await writeFile(join(SRC_DIR, "big.ts"), bigContent);
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("detects TODO comments", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    expect(result.success).toBe(true);
    const todos = result.output!.candidates.filter((c) => c.type === "todo");
    expect(todos.length).toBeGreaterThanOrEqual(1);
    expect(todos[0].file).toContain("todo.ts");
  });

  it("detects FIXME comments with high severity", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const fixmes = result.output!.candidates.filter((c) => c.type === "fixme");
    expect(fixmes.length).toBeGreaterThanOrEqual(1);
    expect(fixmes[0].severity).toBe("high");
  });

  it("detects `: any` usage", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const anys = result.output!.candidates.filter((c) => c.type === "any");
    expect(anys.length).toBeGreaterThanOrEqual(1);
  });

  it("detects eslint-disable inline comments", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const disables = result.output!.candidates.filter((c) => c.type === "eslint-disable");
    expect(disables.length).toBeGreaterThanOrEqual(1);
  });

  it("detects large files (>500 LOC)", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const large = result.output!.candidates.filter((c) => c.type === "large-file");
    expect(large.length).toBeGreaterThanOrEqual(1);
    expect(large[0].file).toContain("big.ts");
  });

  it("detects missing test files", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    const missing = result.output!.candidates.filter((c) => c.type === "missing-test");
    // todo.ts, fixme.ts, disabled.ts, big.ts have no sibling test
    expect(missing.length).toBeGreaterThanOrEqual(3);
  });

  it("respects limit option", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"], limit: 2 }, makeCtx());
    expect(result.output!.candidates.length).toBeLessThanOrEqual(2);
  });

  it("respects fileLevelOnly option", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute(
      { roots: ["src"], fileLevelOnly: true },
      makeCtx(),
    );
    const fileLevel = result.output!.candidates.filter(
      (c) => c.type === "large-file" || c.type === "missing-test",
    );
    expect(fileLevel.length).toBe(0);
  });

  it("reports counts per type", async () => {
    const agent = new SelfDiagnosticAgent(TEST_ROOT);
    const result = await agent.execute({ roots: ["src"] }, makeCtx());
    expect(result.output!.counts.todo).toBeGreaterThan(0);
    expect(result.output!.counts.fixme).toBeGreaterThan(0);
    expect(result.output!.counts.any).toBeGreaterThan(0);
  });
});
