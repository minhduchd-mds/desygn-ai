/**
 * TestGenAgent — proposes test scaffolds for files missing coverage.
 *
 * This v0 deliberately avoids LLM calls: it produces a deterministic template
 * that the user can fill in. Future iterations can plug in an LLM provider
 * (Groq/Anthropic) using the existing chat-engine module.
 */

import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

export interface TestGenInput {
  /** Repo-relative source file path */
  sourceFile: string;
  /** Override target test path */
  targetTestFile?: string;
}

export interface TestGenOutput {
  /** Generated test file content */
  content: string;
  /** Target test file path (repo-relative) */
  testFile: string;
  /** Detected exports from the source file (used as test targets) */
  exports: string[];
}

const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/gm;
const EXPORT_BRACES_RE = /^export\s*\{([^}]+)\}/gm;

export class TestGenAgent extends BaseAgentV6<TestGenInput, TestGenOutput> {
  readonly id = "self-improve.test-gen";
  readonly name = "Test Generator";
  readonly fleet: FleetName = "self-improve";
  readonly role = "generator" as const;
  readonly description = "Generates a test scaffold for a source file";

  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    super();
    this.repoRoot = repoRoot;
  }

  protected async run(
    input: TestGenInput,
    ctx: AgentContextV6,
  ): Promise<{ output: TestGenOutput; filesModified?: string[] }> {
    const sourcePath = join(this.repoRoot, input.sourceFile);
    const source = await readFile(sourcePath, "utf8");

    // Extract named exports
    const exports = new Set<string>();
    let m: RegExpExecArray | null;
    EXPORT_RE.lastIndex = 0;
    while ((m = EXPORT_RE.exec(source))) {
      exports.add(m[1]);
    }
    EXPORT_BRACES_RE.lastIndex = 0;
    while ((m = EXPORT_BRACES_RE.exec(source))) {
      for (const name of m[1].split(",")) {
        const trimmed = name.trim().split(/\s+as\s+/)[0]?.trim();
        if (trimmed) exports.add(trimmed);
      }
    }

    const sourceName = basename(input.sourceFile).replace(/\.(ts|tsx)$/, "");
    const targetDir = input.targetTestFile
      ? dirname(input.targetTestFile)
      : join(dirname(input.sourceFile), "__tests__");
    const targetFile = input.targetTestFile
      ?? `${targetDir}/${sourceName}.test.ts`;
    const relTarget = relative(this.repoRoot, join(this.repoRoot, targetFile)).replace(/\\/g, "/");

    const importPath = computeRelativeImport(targetFile, input.sourceFile);
    const content = buildTestScaffold(sourceName, importPath, Array.from(exports));

    ctx.logger.info(
      `[test-gen] generated scaffold for ${input.sourceFile} → ${relTarget}`,
      { exports: exports.size },
    );

    return {
      output: {
        content,
        testFile: relTarget,
        exports: Array.from(exports),
      },
      filesModified: [relTarget],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeRelativeImport(fromFile: string, toFile: string): string {
  const fromDir = dirname(fromFile);
  const stripped = toFile.replace(/\.(ts|tsx)$/, "");
  let rel = relative(fromDir, stripped).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function buildTestScaffold(
  name: string,
  importPath: string,
  exports: string[],
): string {
  if (exports.length === 0) {
    return `import { describe, it, expect } from "vitest";\nimport * as ${name} from "${importPath}";\n\ndescribe("${name}", () => {\n  it("loads without throwing", () => {\n    expect(${name}).toBeDefined();\n  });\n\n  // TODO: add real test cases\n});\n`;
  }
  const imports = exports.join(", ");
  const tests = exports
    .map(
      (e) =>
        `  describe("${e}", () => {\n    it("is exported", () => {\n      expect(${e}).toBeDefined();\n    });\n\n    // TODO: add behavioural tests for ${e}\n  });`,
    )
    .join("\n\n");
  return `import { describe, it, expect } from "vitest";\nimport { ${imports} } from "${importPath}";\n\ndescribe("${name}", () => {\n${tests}\n});\n`;
}
