/**
 * CodeFixAgent — produces a unified diff from a refactor proposal.
 *
 * Takes a `RefactorProposal` and emits a `git apply`-compatible diff. The diff
 * is line-anchored using the file's current content so it cleanly applies even
 * if the line numbers shifted slightly since the proposal was generated.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import type { RefactorProposal } from "../self-improve/RefactorAgent";

export interface CodeFixInput {
  proposals: RefactorProposal[];
}

export interface CodeFixOutput {
  /** Unified diff that can be fed to `git apply` */
  diff: string;
  /** Files touched (repo-relative) */
  files: string[];
  /** Proposals that could not be turned into a diff (e.g. line drift) */
  unappliable: { id: string; reason: string }[];
}

export class CodeFixAgent extends BaseAgentV6<CodeFixInput, CodeFixOutput> {
  readonly id = "fix.code-fix";
  readonly name = "Code Fix Generator";
  readonly fleet: FleetName = "fix";
  readonly role = "generator" as const;
  readonly description = "Converts refactor proposals into a unified diff";

  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    super();
    this.repoRoot = repoRoot;
  }

  canRunInWorktree(): boolean {
    return true;
  }

  protected async run(
    input: CodeFixInput,
    ctx: AgentContextV6,
  ): Promise<{ output: CodeFixOutput; filesModified?: string[] }> {
    // Group proposals by file
    const byFile = new Map<string, RefactorProposal[]>();
    for (const p of input.proposals) {
      const arr = byFile.get(p.file) ?? [];
      arr.push(p);
      byFile.set(p.file, arr);
    }

    const fileDiffs: string[] = [];
    const filesTouched: string[] = [];
    const unappliable: CodeFixOutput["unappliable"] = [];

    for (const [file, proposals] of byFile) {
      const fullPath = join(this.repoRoot, file);
      let lines: string[];
      try {
        const content = await readFile(fullPath, "utf8");
        lines = content.split(/\r?\n/);
      } catch (err) {
        for (const p of proposals) {
          unappliable.push({
            id: p.id,
            reason: `cannot read file: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        continue;
      }

      const hunks: DiffHunk[] = [];
      // Sort descending by line so we can mutate without invalidating later indices
      const sorted = [...proposals].sort((a, b) => b.line - a.line);
      for (const p of sorted) {
        const lineIdx = p.line - 1;
        const actual = lines[lineIdx];
        if (actual === undefined || actual !== p.before) {
          unappliable.push({
            id: p.id,
            reason: `line drift — expected "${p.before.slice(0, 60)}" got "${(actual ?? "").slice(0, 60)}"`,
          });
          continue;
        }
        hunks.push({ lineNumber: p.line, before: p.before, after: p.after });
      }
      if (hunks.length === 0) continue;

      const diff = buildFileDiff(file, lines, hunks);
      fileDiffs.push(diff);
      filesTouched.push(file);
    }

    ctx.logger.info(
      `[code-fix] generated diff for ${filesTouched.length} files; ${unappliable.length} unappliable`,
    );

    return {
      output: {
        diff: fileDiffs.join("\n"),
        files: filesTouched,
        unappliable,
      },
      filesModified: filesTouched,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal diff builder
// ─────────────────────────────────────────────────────────────────────────────

interface DiffHunk {
  lineNumber: number;
  before: string;
  after: string;
}

function buildFileDiff(file: string, lines: string[], hunks: DiffHunk[]): string {
  // Produce one hunk per change with 3 lines of context on each side.
  const out: string[] = [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`];

  for (const h of hunks) {
    const lineIdx = h.lineNumber - 1;
    const contextStart = Math.max(0, lineIdx - 3);
    const contextEnd = Math.min(lines.length - 1, lineIdx + 3);

    // Header
    const oldCount = contextEnd - contextStart + 1;
    const newCount = h.after === "" ? oldCount - 1 : oldCount;
    out.push(`@@ -${contextStart + 1},${oldCount} +${contextStart + 1},${newCount} @@`);

    for (let i = contextStart; i <= contextEnd; i++) {
      const line = lines[i];
      if (i === lineIdx) {
        out.push(`-${line}`);
        if (h.after !== "") out.push(`+${h.after}`);
      } else {
        out.push(` ${line}`);
      }
    }
  }
  return out.join("\n") + "\n";
}
