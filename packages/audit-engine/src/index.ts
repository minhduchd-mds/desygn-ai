/**
 * @desygn/audit-engine — WCAG accessibility audit orchestrator.
 *
 * Public API:
 *   import { AuditEngine } from "@desygn/audit-engine";
 *   const engine = new AuditEngine(config, logger);
 *   const result = await engine.run({ nodes, options });
 *
 * Each rule is a pure function — engine runs them in parallel,
 * aggregates issues, computes score, returns result.
 */

import { calculateScore, summarize } from "./scoring.js";
import type {
  A11yRule,
  AuditConfig,
  AuditInput,
  AuditResult,
  Logger,
} from "./types.js";

export * from "./types.js";
export { calculateScore, summarize } from "./scoring.js";

export class AuditEngine {
  private readonly config: Required<AuditConfig>;

  constructor(
    private readonly rules: A11yRule[],
    config: AuditConfig = {},
    private readonly logger: Logger = noopLogger,
  ) {
    this.config = {
      maxNodes: config.maxNodes ?? 10000,
      ruleTimeoutMs: config.ruleTimeoutMs ?? 5000,
    };
  }

  async run(input: AuditInput): Promise<AuditResult> {
    const startTime = Date.now();

    if (input.nodes.length > this.config.maxNodes) {
      throw new Error(
        `Input exceeds maxNodes limit (${input.nodes.length} > ${this.config.maxNodes})`,
      );
    }

    const selected = this.selectRules(input.options);
    this.logger.info("audit started", {
      ruleCount: selected.length,
      nodeCount: input.nodes.length,
    });

    // Run all rules in parallel with timeout protection
    const results = await Promise.all(
      selected.map((rule) => this.runRuleWithTimeout(rule, input)),
    );

    const issues = results.flatMap((r) => r.issues);
    const score = calculateScore(issues);
    const summary = summarize(issues);
    const durationMs = Date.now() - startTime;

    this.logger.info("audit completed", { score, issueCount: issues.length, durationMs });

    return {
      id: globalThis.crypto?.randomUUID() ?? `audit-${Date.now()}`,
      score,
      issues,
      summary,
      durationMs,
      wcagVersion: input.options.wcagVersion ?? "2.2",
      wcagLevel: input.options.wcagLevel ?? "AA",
      nodeCount: input.nodes.length,
    };
  }

  private selectRules(options: AuditInput["options"]): A11yRule[] {
    if (!options.rules || options.rules.length === 0) {
      return this.rules;
    }
    const wanted = new Set(options.rules);
    return this.rules.filter((r) => wanted.has(r.id));
  }

  private async runRuleWithTimeout(rule: A11yRule, input: AuditInput) {
    try {
      const result = await Promise.race([
        Promise.resolve(rule.evaluate(input)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Rule timeout: ${rule.id}`)),
            this.config.ruleTimeoutMs,
          ),
        ),
      ]);
      return result;
    } catch (err) {
      this.logger.error("rule failed", {
        ruleId: rule.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return { issues: [] };
    }
  }
}

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
