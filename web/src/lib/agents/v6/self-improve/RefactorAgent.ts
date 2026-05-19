/**
 * RefactorAgent — proposes mechanical refactors for known smells.
 *
 * v0 implements three deterministic refactors (no LLM):
 *   1. Replace `: any` with `: unknown` (safer default)
 *   2. Remove unused eslint-disable comments
 *   3. Suggest extracting functions >80 lines into helpers
 *
 * Each refactor produces a unified diff fragment that the Fix fleet can apply.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

export type RefactorKind = "any-to-unknown" | "remove-unused-disable" | "extract-large-function";

export interface RefactorProposal {
  /** Stable identifier */
  id: string;
  kind: RefactorKind;
  file: string;
  line: number;
  /** Old code snippet */
  before: string;
  /** New code snippet */
  after: string;
  /** Human-readable rationale */
  rationale: string;
  /** Risk: low/medium/high */
  risk: "low" | "medium" | "high";
}

export interface RefactorInput {
  /** Repo-relative file path to analyze */
  file: string;
  /** Optional kinds to include (defaults to all) */
  kinds?: RefactorKind[];
}

export interface RefactorOutput {
  proposals: RefactorProposal[];
}

const ANY_RE = /(\:|<|,|\s)(any)(\b)/g;
const ESLINT_DISABLE_RE = /^\s*\/\/\s*eslint-disable-next-line\b.*$/;
const FUNCTION_START_RE = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;

export class RefactorAgent extends BaseAgentV6<RefactorInput, RefactorOutput> {
  readonly id = "self-improve.refactor";
  readonly name = "Refactor Suggester";
  readonly fleet: FleetName = "self-improve";
  readonly role = "optimizer" as const;
  readonly description = "Proposes mechanical refactors (any→unknown, dead disables, large fn extraction)";

  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    super();
    this.repoRoot = repoRoot;
  }

  protected async run(
    input: RefactorInput,
    ctx: AgentContextV6,
  ): Promise<{ output: RefactorOutput; evidence?: string[] }> {
    const kinds = new Set<RefactorKind>(
      input.kinds ?? ["any-to-unknown", "remove-unused-disable", "extract-large-function"],
    );
    const fullPath = join(this.repoRoot, input.file);
    const content = await readFile(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    const proposals: RefactorProposal[] = [];

    if (kinds.has("any-to-unknown")) {
      lines.forEach((line, idx) => {
        ANY_RE.lastIndex = 0;
        if (ANY_RE.test(line) && !/eslint-disable/.test(line)) {
          const after = line.replace(ANY_RE, (_full, pre, _any, post) => `${pre}unknown${post}`);
          proposals.push({
            id: `any2unknown:${input.file}:${idx + 1}`,
            kind: "any-to-unknown",
            file: input.file,
            line: idx + 1,
            before: line,
            after,
            rationale: "`unknown` forces explicit narrowing — safer default than `any`",
            risk: "medium",
          });
        }
      });
    }

    if (kinds.has("remove-unused-disable")) {
      lines.forEach((line, idx) => {
        if (ESLINT_DISABLE_RE.test(line)) {
          // Heuristic: the disable is "unused" if the next line has no obvious lint trigger.
          const next = lines[idx + 1] ?? "";
          if (!/any|console\.|@ts-/.test(next)) {
            proposals.push({
              id: `disable:${input.file}:${idx + 1}`,
              kind: "remove-unused-disable",
              file: input.file,
              line: idx + 1,
              before: line,
              after: "",
              rationale: "Inline eslint-disable appears unused on the following line",
              risk: "low",
            });
          }
        }
      });
    }

    if (kinds.has("extract-large-function")) {
      let currentFn: { name: string; startLine: number; braceDepth: number } | null = null;
      lines.forEach((line, idx) => {
        if (!currentFn) {
          const m = line.match(FUNCTION_START_RE);
          if (m) {
            currentFn = { name: m[1], startLine: idx + 1, braceDepth: 0 };
          }
        }
        if (currentFn) {
          for (const ch of line) {
            if (ch === "{") currentFn.braceDepth++;
            else if (ch === "}") currentFn.braceDepth--;
          }
          if (currentFn.braceDepth <= 0 && idx > currentFn.startLine) {
            const length = idx + 1 - currentFn.startLine;
            if (length > 80) {
              proposals.push({
                id: `extract:${input.file}:${currentFn.startLine}`,
                kind: "extract-large-function",
                file: input.file,
                line: currentFn.startLine,
                before: `function ${currentFn.name}(...) {  // ${length} lines`,
                after: `// TODO: split ${currentFn.name} into smaller helpers`,
                rationale: `Function ${currentFn.name} is ${length} lines — extract sub-functions for readability`,
                risk: "high",
              });
            }
            currentFn = null;
          }
        }
      });
    }

    ctx.logger.info(`[refactor] ${input.file}: ${proposals.length} proposals`);
    return {
      output: { proposals },
      evidence: [`file=${input.file}`, `proposals=${proposals.length}`],
    };
  }
}
