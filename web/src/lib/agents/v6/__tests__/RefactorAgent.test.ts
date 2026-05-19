import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RefactorAgent } from "../self-improve/RefactorAgent";
import type { AgentContextV6 } from "../BaseAgent";

const TEST_ROOT = join(tmpdir(), `desygn-refactor-${Date.now()}`);

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1",
    projectId: "p1",
    costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("RefactorAgent", () => {
  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });

    await writeFile(
      join(TEST_ROOT, "anyExample.ts"),
      [
        "export function foo(x: any): any {",
        "  return x;",
        "}",
        "",
      ].join("\n"),
    );

    await writeFile(
      join(TEST_ROOT, "disabledExample.ts"),
      [
        "// eslint-disable-next-line",
        'export const ok = "no actual issue on next line";',
        "",
      ].join("\n"),
    );

    // Large function
    const body = Array.from({ length: 85 }, (_, i) => `  const v${i} = ${i};`).join("\n");
    await writeFile(
      join(TEST_ROOT, "largeExample.ts"),
      `export function bigFn() {\n${body}\n}\n`,
    );
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("proposes any-to-unknown refactors", async () => {
    const agent = new RefactorAgent(TEST_ROOT);
    const result = await agent.execute(
      { file: "anyExample.ts", kinds: ["any-to-unknown"] },
      makeCtx(),
    );
    expect(result.success).toBe(true);
    expect(result.output!.proposals.length).toBeGreaterThanOrEqual(1);
    expect(result.output!.proposals[0].kind).toBe("any-to-unknown");
    expect(result.output!.proposals[0].after).toContain("unknown");
  });

  it("proposes removing unused eslint-disable", async () => {
    const agent = new RefactorAgent(TEST_ROOT);
    const result = await agent.execute(
      { file: "disabledExample.ts", kinds: ["remove-unused-disable"] },
      makeCtx(),
    );
    expect(result.success).toBe(true);
    expect(result.output!.proposals.length).toBeGreaterThanOrEqual(1);
    expect(result.output!.proposals[0].risk).toBe("low");
  });

  it("proposes extracting large functions", async () => {
    const agent = new RefactorAgent(TEST_ROOT);
    const result = await agent.execute(
      { file: "largeExample.ts", kinds: ["extract-large-function"] },
      makeCtx(),
    );
    expect(result.success).toBe(true);
    expect(result.output!.proposals.length).toBeGreaterThanOrEqual(1);
    expect(result.output!.proposals[0].kind).toBe("extract-large-function");
    expect(result.output!.proposals[0].risk).toBe("high");
  });

  it("returns empty proposals for clean code", async () => {
    await writeFile(join(TEST_ROOT, "clean.ts"), `export const ok: string = "ok";\n`);
    const agent = new RefactorAgent(TEST_ROOT);
    const result = await agent.execute({ file: "clean.ts" }, makeCtx());
    expect(result.output!.proposals).toHaveLength(0);
  });

  it("filters by kinds option", async () => {
    const agent = new RefactorAgent(TEST_ROOT);
    const result = await agent.execute(
      { file: "anyExample.ts", kinds: ["remove-unused-disable"] },
      makeCtx(),
    );
    // anyExample.ts has no eslint-disable, so 0 proposals
    expect(result.output!.proposals).toHaveLength(0);
  });
});
