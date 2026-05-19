import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodeFixAgent } from "../fix/CodeFixAgent";
import type { AgentContextV6 } from "../BaseAgent";
import type { RefactorProposal } from "../self-improve/RefactorAgent";

const TEST_ROOT = join(tmpdir(), `desygn-codefix-${Date.now()}`);

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1",
    projectId: "p1",
    costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe("CodeFixAgent", () => {
  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    await writeFile(
      join(TEST_ROOT, "sample.ts"),
      ["line1", "line2", "line3 with: any", "line4", "line5", "line6"].join("\n"),
    );
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("generates a unified diff for a valid proposal", async () => {
    const agent = new CodeFixAgent(TEST_ROOT);
    const proposal: RefactorProposal = {
      id: "test:1",
      kind: "any-to-unknown",
      file: "sample.ts",
      line: 3,
      before: "line3 with: any",
      after: "line3 with: unknown",
      rationale: "test",
      risk: "low",
    };
    const result = await agent.execute({ proposals: [proposal] }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.output!.diff).toContain("diff --git");
    expect(result.output!.diff).toContain("-line3 with: any");
    expect(result.output!.diff).toContain("+line3 with: unknown");
    expect(result.output!.files).toContain("sample.ts");
  });

  it("marks proposals as unappliable on line drift", async () => {
    const agent = new CodeFixAgent(TEST_ROOT);
    const proposal: RefactorProposal = {
      id: "test:drift",
      kind: "any-to-unknown",
      file: "sample.ts",
      line: 3,
      before: "this line does not exist",
      after: "irrelevant",
      rationale: "test",
      risk: "low",
    };
    const result = await agent.execute({ proposals: [proposal] }, makeCtx());
    expect(result.output!.unappliable.length).toBe(1);
    expect(result.output!.unappliable[0].reason).toContain("line drift");
  });

  it("handles missing files gracefully", async () => {
    const agent = new CodeFixAgent(TEST_ROOT);
    const proposal: RefactorProposal = {
      id: "test:nofile",
      kind: "any-to-unknown",
      file: "does-not-exist.ts",
      line: 1,
      before: "x",
      after: "y",
      rationale: "test",
      risk: "low",
    };
    const result = await agent.execute({ proposals: [proposal] }, makeCtx());
    expect(result.output!.unappliable.length).toBe(1);
    expect(result.output!.unappliable[0].reason).toContain("cannot read");
  });

  it("groups multiple proposals per file in one diff section", async () => {
    await writeFile(
      join(TEST_ROOT, "multi.ts"),
      ["a", "b", "c"].join("\n"),
    );
    const agent = new CodeFixAgent(TEST_ROOT);
    const result = await agent.execute(
      {
        proposals: [
          {
            id: "1",
            kind: "any-to-unknown",
            file: "multi.ts",
            line: 1,
            before: "a",
            after: "A",
            rationale: "test",
            risk: "low",
          },
          {
            id: "2",
            kind: "any-to-unknown",
            file: "multi.ts",
            line: 3,
            before: "c",
            after: "C",
            rationale: "test",
            risk: "low",
          },
        ],
      },
      makeCtx(),
    );
    expect(result.output!.diff.match(/diff --git/g)).toHaveLength(1);
    expect(result.output!.diff).toContain("-a");
    expect(result.output!.diff).toContain("+A");
    expect(result.output!.diff).toContain("-c");
    expect(result.output!.diff).toContain("+C");
  });

  it("canRunInWorktree returns true", () => {
    const agent = new CodeFixAgent(TEST_ROOT);
    expect(agent.canRunInWorktree()).toBe(true);
  });
});
