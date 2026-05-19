/**
 * SelfDiagnosticAgent — pure static analysis of the Desygn AI codebase.
 *
 * Scans the repository for code smells that the self-improvement fleet can act on:
 *   - TODO / FIXME / HACK markers (priority: medium)
 *   - eslint-disable inline rules (priority: medium)
 *   - Large files (>500 LOC) — refactor candidates (priority: low)
 *   - Type-any usage — type safety issues (priority: medium)
 *   - Files without a sibling test (priority: low)
 *
 * No LLM calls — deterministic and free. Output feeds the Orchestrator's GOAP
 * planner, which decides which candidates to spawn into worktrees.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export interface ImprovementCandidate {
  /** Stable ID derived from file + line */
  id: string;
  /** Issue category */
  type: "todo" | "fixme" | "hack" | "any" | "eslint-disable" | "large-file" | "missing-test";
  /** Severity for prioritization */
  severity: IssueSeverity;
  /** Repo-relative file path */
  file: string;
  /** Line number (1-based), 0 for whole-file issues */
  line: number;
  /** Human-readable description */
  description: string;
  /** Estimated minutes to fix (rough heuristic) */
  estimatedMinutes: number;
}

export interface SelfDiagnosticInput {
  /** Directories to scan (defaults to ["web/src", "shared", "sdk", "api"]) */
  roots?: string[];
  /** Maximum candidates to return (default 100) */
  limit?: number;
  /** Skip whole-file checks (large-file, missing-test) */
  fileLevelOnly?: boolean;
}

export interface SelfDiagnosticOutput {
  candidates: ImprovementCandidate[];
  /** Summary stats keyed by issue type */
  counts: Record<ImprovementCandidate["type"], number>;
  /** Number of files scanned */
  filesScanned: number;
  /** Number of files skipped (node_modules, .git, etc.) */
  filesSkipped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ROOTS = ["web/src", "shared", "sdk", "api"];
const TS_EXT = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", "storybook-static"]);
const LARGE_FILE_THRESHOLD = 500;

const TODO_RE = /(?:\/\/|\/\*|\*)\s*(TODO|FIXME|HACK)[:\s]/;
const ANY_RE = /:\s*any\b/;
const ESLINT_DISABLE_RE = /\beslint-disable(?:-next-line|-line)?\b/;

// ─────────────────────────────────────────────────────────────────────────────
// Agent
// ─────────────────────────────────────────────────────────────────────────────

export class SelfDiagnosticAgent extends BaseAgentV6<
  SelfDiagnosticInput,
  SelfDiagnosticOutput
> {
  readonly id = "self-improve.diagnostic";
  readonly name = "Self-Diagnostic";
  readonly fleet: FleetName = "self-improve";
  readonly role = "analyzer" as const;
  readonly description = "Scans the codebase for code smells, TODOs, type-any, and large files";

  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    super();
    this.repoRoot = repoRoot;
  }

  protected async run(
    input: SelfDiagnosticInput,
    ctx: AgentContextV6,
  ): Promise<{ output: SelfDiagnosticOutput; evidence?: string[] }> {
    const roots = input.roots ?? DEFAULT_ROOTS;
    const limit = input.limit ?? 100;
    const candidates: ImprovementCandidate[] = [];
    const counts: Record<ImprovementCandidate["type"], number> = {
      todo: 0,
      fixme: 0,
      hack: 0,
      any: 0,
      "eslint-disable": 0,
      "large-file": 0,
      "missing-test": 0,
    };

    let filesScanned = 0;
    let filesSkipped = 0;
    const allFiles: string[] = [];

    for (const root of roots) {
      await walk(join(this.repoRoot, root), (path) => allFiles.push(path));
    }

    for (const filePath of allFiles) {
      if (!TS_EXT.test(filePath)) {
        filesSkipped++;
        continue;
      }
      filesScanned++;
      const relPath = relative(this.repoRoot, filePath).replace(/\\/g, "/");

      const content = await readFile(filePath, "utf8");
      const lines = content.split(/\r?\n/);

      // Line-level scans
      lines.forEach((line, idx) => {
        const todoMatch = line.match(TODO_RE);
        if (todoMatch) {
          const tag = todoMatch[1].toLowerCase() as "todo" | "fixme" | "hack";
          counts[tag]++;
          if (candidates.length < limit) {
            candidates.push({
              id: `${tag}:${relPath}:${idx + 1}`,
              type: tag,
              severity: tag === "fixme" || tag === "hack" ? "high" : "medium",
              file: relPath,
              line: idx + 1,
              description: line.trim().slice(0, 200),
              estimatedMinutes: tag === "hack" ? 30 : 15,
            });
          }
        }
        if (ANY_RE.test(line) && !line.includes("// eslint-disable")) {
          counts.any++;
          if (candidates.length < limit) {
            candidates.push({
              id: `any:${relPath}:${idx + 1}`,
              type: "any",
              severity: "medium",
              file: relPath,
              line: idx + 1,
              description: `Type "any" usage — replace with specific type`,
              estimatedMinutes: 10,
            });
          }
        }
        if (ESLINT_DISABLE_RE.test(line)) {
          counts["eslint-disable"]++;
          if (candidates.length < limit) {
            candidates.push({
              id: `disable:${relPath}:${idx + 1}`,
              type: "eslint-disable",
              severity: "low",
              file: relPath,
              line: idx + 1,
              description: line.trim().slice(0, 200),
              estimatedMinutes: 5,
            });
          }
        }
      });

      // Whole-file scans
      if (!input.fileLevelOnly && lines.length > LARGE_FILE_THRESHOLD && !TEST_FILE.test(filePath)) {
        counts["large-file"]++;
        if (candidates.length < limit) {
          candidates.push({
            id: `large:${relPath}`,
            type: "large-file",
            severity: "low",
            file: relPath,
            line: 0,
            description: `File has ${lines.length} lines — consider splitting`,
            estimatedMinutes: 60,
          });
        }
      }
    }

    // Missing test detection
    if (!input.fileLevelOnly) {
      const tsFiles = allFiles.filter((f) => TS_EXT.test(f) && !TEST_FILE.test(f));
      const testFiles = new Set(
        allFiles
          .filter((f) => TEST_FILE.test(f))
          .map((f) => f.replace(/\.(test|spec)\./, ".")),
      );
      for (const source of tsFiles) {
        if (!testFiles.has(source)) {
          counts["missing-test"]++;
          if (candidates.length < limit) {
            const rel = relative(this.repoRoot, source).replace(/\\/g, "/");
            candidates.push({
              id: `notest:${rel}`,
              type: "missing-test",
              severity: "low",
              file: rel,
              line: 0,
              description: "No sibling .test.ts or .spec.ts file found",
              estimatedMinutes: 30,
            });
          }
        }
      }
    }

    ctx.logger.info(
      `[self-diagnostic] found ${candidates.length} candidates across ${filesScanned} files`,
    );

    return {
      output: { candidates, counts, filesScanned, filesSkipped },
      evidence: [
        `scanned=${filesScanned}`,
        `candidates=${candidates.length}`,
        ...Object.entries(counts).map(([k, v]) => `${k}=${v}`),
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function walk(dir: string, onFile: (path: string) => void): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      await walk(full, onFile);
    } else if (s.isFile()) {
      onFile(full);
    }
  }
}
