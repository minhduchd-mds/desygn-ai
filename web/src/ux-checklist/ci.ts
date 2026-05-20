/**
 * ci.ts — CI/CD Gate & PR Automation Layer
 *
 * Integrates the Agentic UI/UX Auditor into deployment pipelines.
 * Generates configs and scripts for GitHub Actions, Vercel, Netlify,
 * and produces SARIF reports for GitHub Code Scanning.
 *
 * Key capabilities:
 *   • CIGate: Evaluate audit reports against configurable thresholds
 *   • PRAutomation: Generate branch names, PR bodies, and commit messages from fix plans
 *   • SARIFReport: Produce GitHub Code Scanning compatible output
 *   • DeployGate: Provider-specific integration (Vercel, Netlify, GitHub Pages)
 */

import type {
  AuditReport,
  AuditResult,
  AuditCriterion,
  AuditSeverity,
  AuditCategory,
} from "./index";
import type { FixPlan } from "./github";

// ── CI Gate Types ─────────────────────────────────────────────────

/** Configuration for the CI gate evaluation */
export interface CIGateConfig {
  /** Minimum overall score to pass (0-100) */
  scoreThreshold: number;
  /** Whether critical-severity failures always block */
  blockOnCritical: boolean;
  /** Whether major-severity failures block */
  blockOnMajor: boolean;
  /** Maximum allowed critical failures before blocking */
  maxCriticalFailures: number;
  /** Maximum allowed major failures before blocking */
  maxMajorFailures: number;
  /** Categories to ignore in gate evaluation */
  ignoredCategories: AuditCategory[];
  /** Whether to treat warnings as informational only */
  warningsAsInfo: boolean;
}

/** Result of evaluating an audit report against the CI gate */
export interface CIGateResult {
  /** Whether the gate passed */
  passed: boolean;
  /** The overall audit score */
  score: number;
  /** The configured threshold */
  threshold: number;
  /** Critical failures that blocked the gate */
  criticalFailures: string[];
  /** Non-critical blockers (major failures exceeding limit) */
  blockers: string[];
  /** Warnings that did not block but should be addressed */
  warnings: string[];
  /** Human-readable summary of the gate result */
  summary: string;
  /** Process exit code: 0 for pass, 1 for fail */
  exitCode: 0 | 1;
}

// ── PR Automation Types ───────────────────────────────────────────

/** Full context for creating a pull request from a fix plan */
export interface PRContext {
  /** Base branch to merge into */
  baseBranch: string;
  /** Feature branch with the fix */
  fixBranch: string;
  /** PR title */
  title: string;
  /** PR body (Markdown) */
  body: string;
  /** Labels to apply */
  labels: string[];
  /** Requested reviewers (GitHub usernames) */
  reviewers: string[];
  /** Linked issue references (e.g., "#42") */
  linkedIssues: string[];
  /** The audit report ID this PR relates to */
  auditReportId: string;
}

// ── SARIF Types ───────────────────────────────────────────────────

/** SARIF rule definition */
export interface SARIFRule {
  /** Rule ID matching the criterion ID */
  id: string;
  /** Short description */
  shortDescription: { text: string };
  /** Full description */
  fullDescription: { text: string };
  /** Help URI */
  helpUri?: string;
  /** Default configuration */
  defaultConfiguration: {
    level: "error" | "warning" | "note" | "none";
  };
  /** Properties bag */
  properties?: {
    tags?: string[];
    category?: string;
  };
}

/** SARIF result entry */
export interface SARIFResult {
  /** Rule ID */
  ruleId: string;
  /** Severity level */
  level: "error" | "warning" | "note" | "none";
  /** Message */
  message: { text: string };
  /** Locations (optional, UX audits may not have file locations) */
  locations?: Array<{
    physicalLocation?: {
      artifactLocation: { uri: string };
      region?: { startLine: number; startColumn?: number };
    };
  }>;
  /** Properties */
  properties?: Record<string, unknown>;
}

/** Full SARIF output structure (v2.1.0) */
export interface SARIFOutput {
  /** SARIF version */
  version: "2.1.0";
  /** JSON Schema reference */
  $schema: string;
  /** Analysis runs */
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri?: string;
        rules: SARIFRule[];
      };
    };
    results: SARIFResult[];
  }>;
}

// ── Deploy Gate Types ─────────────────────────────────────────────

/** Configuration for deployment provider integration */
export interface DeployGateConfig {
  /** Which deployment provider to target */
  provider: "vercel" | "netlify" | "github-pages";
  /** Minimum score to allow deployment */
  scoreThreshold: number;
  /** Whether critical-severity failures block deploy */
  blockOnCritical: boolean;
  /** Whether to send notifications on warnings */
  notifyOnWarn: boolean;
  /** Optional Slack webhook for notifications */
  slackWebhook?: string;
}

// ── Default Configurations ────────────────────────────────────────

const DEFAULT_CI_GATE_CONFIG: CIGateConfig = {
  scoreThreshold: 70,
  blockOnCritical: true,
  blockOnMajor: false,
  maxCriticalFailures: 0,
  maxMajorFailures: 3,
  ignoredCategories: [],
  warningsAsInfo: false,
};

// ── CIGate ────────────────────────────────────────────────────────

/**
 * CI Gate evaluator that determines whether a deployment should proceed
 * based on audit report scores and configurable thresholds.
 *
 * @example
 * ```typescript
 * const gate = new CIGate({ scoreThreshold: 80, blockOnCritical: true });
 * const result = gate.evaluate(auditReport);
 * process.exit(result.exitCode);
 * ```
 */
export class CIGate {
  private config: CIGateConfig;

  constructor(config: Partial<CIGateConfig> = {}) {
    this.config = { ...DEFAULT_CI_GATE_CONFIG, ...config };
  }

  /**
   * Evaluate an audit report against the gate configuration.
   * @param report - The completed audit report to evaluate
   * @returns Gate result with pass/fail status and details
   */
  evaluate(report: AuditReport): CIGateResult {
    const criticalFailures: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    for (const result of report.results) {
      // Skip ignored categories
      if (this.isIgnoredResult(result, report)) {
        continue;
      }

      if (result.status === "fail") {
        const severity = this.inferSeverity(result);

        if (severity === "critical") {
          criticalFailures.push(
            `[CRITICAL] ${result.criterionId}: ${result.findings}`
          );
        } else if (severity === "major") {
          blockers.push(`[MAJOR] ${result.criterionId}: ${result.findings}`);
        } else {
          warnings.push(`[${severity.toUpperCase()}] ${result.criterionId}: ${result.findings}`);
        }
      } else if (result.status === "warn") {
        warnings.push(`[WARN] ${result.criterionId}: ${result.findings}`);
      }
    }

    // Determine pass/fail
    const scorePassed = report.overallScore >= this.config.scoreThreshold;
    const criticalPassed =
      !this.config.blockOnCritical ||
      criticalFailures.length <= this.config.maxCriticalFailures;
    const majorPassed =
      !this.config.blockOnMajor ||
      blockers.length <= this.config.maxMajorFailures;

    const passed = scorePassed && criticalPassed && majorPassed;

    const summary = this.buildSummary(
      passed,
      report.overallScore,
      criticalFailures.length,
      blockers.length,
      warnings.length
    );

    return {
      passed,
      score: report.overallScore,
      threshold: this.config.scoreThreshold,
      criticalFailures,
      blockers,
      warnings,
      summary,
      exitCode: passed ? 0 : 1,
    };
  }

  /**
   * Generate a GitHub Actions workflow YAML string for running UX audits.
   * @returns Complete workflow YAML as a string
   */
  generateGitHubAction(): string {
    return `# Generated by Agentic UI/UX Auditor CI Gate
name: UX Audit

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  ux-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run UX Audit
        id: audit
        run: npx ux-audit --format sarif --output ux-audit.sarif --json-output ux-audit.json

      - name: Evaluate CI Gate
        id: gate
        run: |
          npx ux-audit-gate \\
            --report ux-audit.json \\
            --threshold ${this.config.scoreThreshold} \\
            --block-on-critical ${this.config.blockOnCritical} \\
            --max-critical ${this.config.maxCriticalFailures} \\
            --max-major ${this.config.maxMajorFailures}

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ux-audit.sarif
          category: ux-audit

      - name: Post PR Comment
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('ux-audit.json', 'utf8'));
            const score = report.overallScore;
            const emoji = score >= ${this.config.scoreThreshold} ? '✅' : '❌';
            const body = [
              \`## \${emoji} UX Audit Results\`,
              \`**Score:** \${score}/100 (threshold: ${this.config.scoreThreshold})\`,
              \`**Critical Issues:** \${report.results.filter(r => r.status === 'fail').length}\`,
              \`**Warnings:** \${report.results.filter(r => r.status === 'warn').length}\`,
              '',
              '---',
              '*Generated by Agentic UI/UX Auditor*'
            ].join('\\n');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
`;
  }

  /**
   * Generate a Vercel build plugin configuration string.
   * @returns JSON configuration for Vercel integration
   */
  generateVercelCheck(): string {
    const config = {
      name: "ux-audit-gate",
      version: "1.0.0",
      description: "Blocks deployment if UX audit score is below threshold",
      settings: {
        scoreThreshold: this.config.scoreThreshold,
        blockOnCritical: this.config.blockOnCritical,
        maxCriticalFailures: this.config.maxCriticalFailures,
        maxMajorFailures: this.config.maxMajorFailures,
      },
      checks: [
        {
          name: "UX Audit Score",
          path: "/**",
          blocking: true,
          command: `npx ux-audit-gate --threshold ${this.config.scoreThreshold}`,
        },
      ],
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * Format a gate result in the specified output format.
   * @param result - The gate evaluation result
   * @param format - Output format: markdown, json, or sarif
   * @returns Formatted string representation
   */
  formatOutput(
    result: CIGateResult,
    format: "markdown" | "json" | "sarif"
  ): string {
    switch (format) {
      case "markdown":
        return this.formatMarkdown(result);
      case "json":
        return JSON.stringify(result, null, 2);
      case "sarif":
        return JSON.stringify(this.resultToSARIF(result), null, 2);
    }
  }

  // ── Private helpers ───────────────────────────────────────────

  /** Check if a result belongs to an ignored category */
  private isIgnoredResult(result: AuditResult, _report: AuditReport): boolean {
    // We cannot directly determine category from AuditResult alone,
    // but metadata may contain it
    const category = result.metadata?.category as AuditCategory | undefined;
    if (category && this.config.ignoredCategories.includes(category)) {
      return true;
    }
    return false;
  }

  /** Infer severity from result metadata */
  private inferSeverity(result: AuditResult): AuditSeverity {
    if (result.metadata?.severity) {
      return result.metadata.severity as AuditSeverity;
    }
    // Heuristic: low scores on failed results are more severe
    if (result.score <= 2) return "critical";
    if (result.score <= 4) return "major";
    if (result.score <= 6) return "minor";
    return "info";
  }

  /** Build a human-readable summary string */
  private buildSummary(
    passed: boolean,
    score: number,
    criticalCount: number,
    majorCount: number,
    warnCount: number
  ): string {
    const status = passed ? "PASSED" : "FAILED";
    const lines = [
      `CI Gate: ${status}`,
      `Score: ${score}/100 (threshold: ${this.config.scoreThreshold})`,
    ];

    if (criticalCount > 0) {
      lines.push(`Critical failures: ${criticalCount}`);
    }
    if (majorCount > 0) {
      lines.push(`Major issues: ${majorCount}`);
    }
    if (warnCount > 0) {
      lines.push(`Warnings: ${warnCount}`);
    }

    if (!passed) {
      const reasons: string[] = [];
      if (score < this.config.scoreThreshold) {
        reasons.push(`score below threshold (${score} < ${this.config.scoreThreshold})`);
      }
      if (this.config.blockOnCritical && criticalCount > this.config.maxCriticalFailures) {
        reasons.push(`critical failures exceed limit (${criticalCount} > ${this.config.maxCriticalFailures})`);
      }
      if (this.config.blockOnMajor && majorCount > this.config.maxMajorFailures) {
        reasons.push(`major issues exceed limit (${majorCount} > ${this.config.maxMajorFailures})`);
      }
      lines.push(`Blocked because: ${reasons.join("; ")}`);
    }

    return lines.join("\n");
  }

  /** Format result as Markdown */
  private formatMarkdown(result: CIGateResult): string {
    const icon = result.passed ? "✅" : "❌";
    const lines = [
      `## ${icon} CI Gate Result`,
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Status | ${result.passed ? "PASSED" : "FAILED"} |`,
      `| Score | ${result.score}/100 |`,
      `| Threshold | ${result.threshold} |`,
      `| Exit Code | ${result.exitCode} |`,
      "",
    ];

    if (result.criticalFailures.length > 0) {
      lines.push("### Critical Failures");
      result.criticalFailures.forEach((f) => lines.push(`- ${f}`));
      lines.push("");
    }

    if (result.blockers.length > 0) {
      lines.push("### Blockers");
      result.blockers.forEach((b) => lines.push(`- ${b}`));
      lines.push("");
    }

    if (result.warnings.length > 0) {
      lines.push("### Warnings");
      result.warnings.forEach((w) => lines.push(`- ${w}`));
      lines.push("");
    }

    lines.push("---");
    lines.push("*Generated by Agentic UI/UX Auditor*");

    return lines.join("\n");
  }

  /** Convert a gate result to minimal SARIF for inline annotations */
  private resultToSARIF(result: CIGateResult): SARIFOutput {
    const results: SARIFResult[] = [
      ...result.criticalFailures.map((f) => ({
        ruleId: "ux-gate/critical",
        level: "error" as const,
        message: { text: f },
      })),
      ...result.blockers.map((b) => ({
        ruleId: "ux-gate/major",
        level: "warning" as const,
        message: { text: b },
      })),
      ...result.warnings.map((w) => ({
        ruleId: "ux-gate/warning",
        level: "note" as const,
        message: { text: w },
      })),
    ];

    return {
      version: "2.1.0",
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "Agentic UX Auditor",
              version: "4.0.0",
              informationUri: "https://github.com/minhduchd-mds/desygn-ai",
              rules: [
                {
                  id: "ux-gate/critical",
                  shortDescription: { text: "Critical UX failure" },
                  fullDescription: { text: "A critical UX criterion has failed and blocks deployment." },
                  defaultConfiguration: { level: "error" },
                },
                {
                  id: "ux-gate/major",
                  shortDescription: { text: "Major UX issue" },
                  fullDescription: { text: "A major UX criterion has failed." },
                  defaultConfiguration: { level: "warning" },
                },
                {
                  id: "ux-gate/warning",
                  shortDescription: { text: "UX warning" },
                  fullDescription: { text: "A UX concern that should be addressed." },
                  defaultConfiguration: { level: "note" },
                },
              ],
            },
          },
          results,
        },
      ],
    };
  }
}

// ── PRAutomation ──────────────────────────────────────────────────

/**
 * Automates pull request creation from audit fix plans.
 * Generates branch names, PR bodies, commit messages, and merge checklists.
 *
 * @example
 * ```typescript
 * const pr = new PRAutomation();
 * const branch = pr.generateBranchName(criterion);
 * const body = pr.generatePRBody(fixPlan, auditResult);
 * const context = pr.createPRContext(fixPlan, result, criterion);
 * ```
 */
export class PRAutomation {
  /**
   * Generate a descriptive branch name from an audit criterion.
   * Format: `fix/<category>-<sanitized-title>`
   * @param criterion - The criterion being fixed
   * @returns A git-safe branch name
   */
  generateBranchName(criterion: AuditCriterion): string {
    const sanitized = criterion.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    return `fix/${criterion.category}-${sanitized}`;
  }

  /**
   * Generate a full PR body from a fix plan and audit result.
   * Includes summary, steps, before/after, and metadata.
   * @param fixPlan - The planned fix with steps and outcomes
   * @param auditResult - The original failing audit result
   * @returns Markdown-formatted PR body
   */
  generatePRBody(fixPlan: FixPlan, auditResult: AuditResult): string {
    const stepsMarkdown = fixPlan.steps
      .map((step, i) => `${i + 1}. ${step}`)
      .join("\n");

    const criteriaMarkdown = fixPlan.criteriaIds
      .map((id) => `- \`${id}\``)
      .join("\n");

    return [
      "## Summary",
      "",
      fixPlan.summary,
      "",
      "## Audit Context",
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Criterion | \`${auditResult.criterionId}\` |`,
      `| Score | ${auditResult.score}/10 |`,
      `| Confidence | ${(auditResult.confidence * 100).toFixed(0)}% |`,
      `| Agent | ${auditResult.agentId} |`,
      "",
      "## Fix Steps",
      "",
      stepsMarkdown,
      "",
      "## Before / After",
      "",
      "**Before:**",
      fixPlan.before,
      "",
      "**After:**",
      fixPlan.after,
      "",
      "## Criteria Addressed",
      "",
      criteriaMarkdown,
      "",
      "## Estimated Effort",
      "",
      `~${fixPlan.estimatedHours} hour${fixPlan.estimatedHours !== 1 ? "s" : ""}`,
      "",
      "---",
      "*Generated by Agentic UI/UX Auditor*",
    ].join("\n");
  }

  /**
   * Generate a conventional commit message for the fix.
   * @param fixPlan - The fix plan to summarize
   * @returns A commit message following conventional commits format
   */
  generateCommitMessage(fixPlan: FixPlan): string {
    const scope = fixPlan.criteriaIds.length === 1
      ? fixPlan.criteriaIds[0]
      : "ux-audit";

    // Truncate summary to 72 chars for subject line
    const subject = fixPlan.summary.length > 60
      ? fixPlan.summary.slice(0, 57) + "..."
      : fixPlan.summary;

    const body = [
      "",
      `Addresses: ${fixPlan.criteriaIds.join(", ")}`,
      "",
      "Steps taken:",
      ...fixPlan.steps.map((s) => `- ${s}`),
      "",
      `Estimated effort: ${fixPlan.estimatedHours}h`,
    ].join("\n");

    return `fix(${scope}): ${subject}\n${body}`;
  }

  /**
   * Create a full PR context object from a fix plan, result, and criterion.
   * @param fixPlan - The planned fix
   * @param result - The audit result that triggered the fix
   * @param criterion - The criterion definition
   * @returns Complete PR context ready for submission
   */
  createPRContext(
    fixPlan: FixPlan,
    result: AuditResult,
    criterion: AuditCriterion
  ): PRContext {
    const branchName = this.generateBranchName(criterion);
    const body = this.generatePRBody(fixPlan, result);
    const title = `fix(${criterion.category}): ${criterion.title}`;

    return {
      baseBranch: "main",
      fixBranch: branchName,
      title: title.length > 72 ? title.slice(0, 69) + "..." : title,
      body,
      labels: this.inferLabels(criterion),
      reviewers: [],
      linkedIssues: [],
      auditReportId: result.evidenceId ?? "",
    };
  }

  /**
   * Generate a checklist of items to verify before merging the PR.
   * @param pr - The PR context
   * @returns Array of checklist item strings
   */
  generateMergeChecklist(pr: PRContext): string[] {
    return [
      "[ ] Visual regression tests pass",
      "[ ] Accessibility audit re-run shows improvement",
      "[ ] No new warnings introduced",
      `[ ] Branch \`${pr.fixBranch}\` is up-to-date with \`${pr.baseBranch}\``,
      "[ ] Design review approved",
      "[ ] Component storybook updated (if applicable)",
      "[ ] CHANGELOG entry added",
      "[ ] Linked audit criteria re-evaluated",
    ];
  }

  // ── Private helpers ───────────────────────────────────────────

  /** Infer appropriate labels from a criterion */
  private inferLabels(criterion: AuditCriterion): string[] {
    const labels: string[] = ["ux-audit", "automated-fix"];

    // Severity label
    labels.push(`severity:${criterion.severity}`);

    // Category label
    labels.push(`category:${criterion.category}`);

    // Source label
    if (criterion.source === "wcag") {
      labels.push("accessibility");
    }

    return labels;
  }
}

// ── SARIF Report Generator ────────────────────────────────────────

/**
 * Generate a full SARIF report from an audit report and criteria registry.
 * Compatible with GitHub Code Scanning for inline annotations.
 *
 * @param report - The completed audit report
 * @param criteria - Map of criterion IDs to their definitions
 * @returns SARIF v2.1.0 output structure
 */
export function generateSARIF(
  report: AuditReport,
  criteria: Map<string, AuditCriterion>
): SARIFOutput {
  const rules: SARIFRule[] = [];
  const results: SARIFResult[] = [];
  const seenRules = new Set<string>();

  for (const result of report.results) {
    if (result.status === "pass" || result.status === "untested") {
      continue;
    }

    const criterion = criteria.get(result.criterionId);
    const ruleId = result.criterionId;

    // Add rule if not already seen
    if (!seenRules.has(ruleId)) {
      seenRules.add(ruleId);
      rules.push({
        id: ruleId,
        shortDescription: {
          text: criterion?.title ?? result.criterionId,
        },
        fullDescription: {
          text: criterion?.description ?? result.findings,
        },
        helpUri: criterion?.wcagRef
          ? `https://www.w3.org/WAI/WCAG21/Understanding/${criterion.wcagRef}`
          : undefined,
        defaultConfiguration: {
          level: severityToSARIFLevel(criterion?.severity ?? "minor"),
        },
        properties: criterion
          ? {
              tags: criterion.tags,
              category: criterion.category,
            }
          : undefined,
      });
    }

    // Add result
    results.push({
      ruleId,
      level: severityToSARIFLevel(criterion?.severity ?? "minor"),
      message: {
        text: `${result.findings}\n\nRecommendation: ${result.recommendation}`,
      },
      properties: {
        score: result.score,
        confidence: result.confidence,
        agentId: result.agentId,
        timestamp: result.timestamp,
      },
    });
  }

  return {
    version: "2.1.0",
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Agentic UX Auditor",
            version: "4.0.0",
            informationUri: "https://github.com/minhduchd-mds/desygn-ai",
            rules,
          },
        },
        results,
      },
    ],
  };
}

// ── DeployGate ────────────────────────────────────────────────────

/**
 * Deployment gate for provider-specific integration.
 * Determines whether a deploy should be blocked and generates
 * notification payloads for Slack and webhooks.
 *
 * @example
 * ```typescript
 * const gate = new DeployGate();
 * if (gate.shouldBlock(report, config)) {
 *   const payload = gate.generateWebhookPayload(report);
 *   await fetch(config.slackWebhook, { method: 'POST', body: JSON.stringify(payload) });
 * }
 * ```
 */
export class DeployGate {
  /**
   * Determine whether deployment should be blocked based on the report and config.
   * @param report - The audit report to evaluate
   * @param config - Provider-specific gate configuration
   * @returns true if deployment should be blocked
   */
  shouldBlock(report: AuditReport, config: DeployGateConfig): boolean {
    // Score check
    if (report.overallScore < config.scoreThreshold) {
      return true;
    }

    // Critical failure check
    if (config.blockOnCritical) {
      const hasCritical = report.results.some(
        (r) =>
          r.status === "fail" &&
          (r.metadata?.severity === "critical" || r.score <= 2)
      );
      if (hasCritical) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a generic webhook payload from an audit report.
   * Suitable for any HTTP webhook consumer.
   * @param report - The audit report
   * @returns Structured payload object
   */
  generateWebhookPayload(report: AuditReport): Record<string, unknown> {
    const failures = report.results.filter((r) => r.status === "fail");
    const warnings = report.results.filter((r) => r.status === "warn");

    return {
      event: "ux-audit-complete",
      timestamp: new Date(report.timestamp).toISOString(),
      project: report.projectName,
      reportId: report.id,
      score: report.overallScore,
      confidence: report.overallConfidence,
      totalResults: report.results.length,
      failures: failures.length,
      warnings: warnings.length,
      debtEstimateHours: report.debtEstimateHours,
      topIssues: failures.slice(0, 5).map((f) => ({
        criterion: f.criterionId,
        score: f.score,
        finding: f.findings,
      })),
    };
  }

  /**
   * Format a Slack Block Kit message from a CI gate result.
   * @param result - The gate evaluation result
   * @returns Slack message payload with Block Kit blocks
   */
  formatSlackMessage(result: CIGateResult): Record<string, unknown> {
    const statusEmoji = result.passed ? ":white_check_mark:" : ":x:";
    const statusText = result.passed ? "Passed" : "Failed";

    const blocks: Array<Record<string, unknown>> = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusEmoji} UX Audit Gate: ${statusText}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Score:*\n${result.score}/100`,
          },
          {
            type: "mrkdwn",
            text: `*Threshold:*\n${result.threshold}`,
          },
          {
            type: "mrkdwn",
            text: `*Critical:*\n${result.criticalFailures.length}`,
          },
          {
            type: "mrkdwn",
            text: `*Warnings:*\n${result.warnings.length}`,
          },
        ],
      },
    ];

    if (result.criticalFailures.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Critical Failures:*\n${result.criticalFailures.slice(0, 3).join("\n")}`,
        },
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Generated by Agentic UI/UX Auditor",
        },
      ],
    });

    return {
      blocks,
      text: `UX Audit Gate ${statusText}: ${result.score}/100`,
    };
  }
}

// ── Utility Functions ─────────────────────────────────────────────

/**
 * Map audit severity to SARIF level.
 * @param severity - The audit severity
 * @returns SARIF-compatible level string
 */
function severityToSARIFLevel(
  severity: AuditSeverity
): "error" | "warning" | "note" | "none" {
  switch (severity) {
    case "critical":
      return "error";
    case "major":
      return "warning";
    case "minor":
      return "note";
    case "info":
      return "none";
  }
}
