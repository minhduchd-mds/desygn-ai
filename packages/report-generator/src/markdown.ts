/**
 * markdown — Render audit result as Markdown.
 *
 * Free tier reports include a "Powered by Desygn A11y" watermark line.
 */

import type { AuditResult, AuditIssue } from "@desygn/audit-engine";

export interface MarkdownOptions {
  watermark?: boolean;
  branding?: { companyName?: string; logoUrl?: string };
}

export function generateMarkdown(audit: AuditResult, options: MarkdownOptions = {}): string {
  const lines: string[] = [];

  const heading = options.branding?.companyName
    ? `# ${options.branding.companyName} — Accessibility Audit Report`
    : "# Accessibility Audit Report";
  lines.push(heading);
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**WCAG Version:** ${audit.wcagVersion} ${audit.wcagLevel}`);
  lines.push(`**Score:** ${audit.score}/100`);
  lines.push(`**Nodes evaluated:** ${audit.nodeCount}`);
  lines.push(`**Duration:** ${audit.durationMs}ms`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("|---|---|");
  lines.push(`| Critical | ${audit.summary.critical} |`);
  lines.push(`| Serious | ${audit.summary.serious} |`);
  lines.push(`| Moderate | ${audit.summary.moderate} |`);
  lines.push(`| Minor | ${audit.summary.minor} |`);
  lines.push(`| **Total** | **${audit.summary.total}** |`);
  lines.push("");

  // By category
  lines.push("### By category");
  lines.push("");
  for (const [cat, count] of Object.entries(audit.summary.byCategory)) {
    if (count > 0) lines.push(`- **${cat}**: ${count}`);
  }
  lines.push("");

  // Issues
  lines.push("## Issues");
  lines.push("");
  for (const issue of audit.issues) {
    lines.push(formatIssue(issue));
    lines.push("");
  }

  // Watermark
  if (options.watermark) {
    lines.push("---");
    lines.push("");
    lines.push("*Powered by [Desygn A11y](https://a11y.desygn.ai) — Free tier.*");
  }

  return lines.join("\n");
}

function formatIssue(issue: AuditIssue): string {
  const lines: string[] = [];
  lines.push(`### ${severityIcon(issue.severity)} ${issue.message}`);
  lines.push("");
  lines.push(`- **Rule:** \`${issue.ruleId}\` (WCAG ${issue.wcagCriterion})`);
  lines.push(`- **Severity:** ${issue.severity}`);
  lines.push(`- **Node:** ${issue.nodeName} (\`${issue.nodeType}\`, id: ${issue.nodeId})`);
  if (issue.pageName) lines.push(`- **Page:** ${issue.pageName}`);
  if (issue.expected) lines.push(`- **Expected:** ${issue.expected}`);
  if (issue.observed) lines.push(`- **Observed:** ${issue.observed}`);
  if (issue.fixSuggestion) {
    lines.push("");
    lines.push(`**How to fix:** ${issue.fixSuggestion.summary}`);
    for (const step of issue.fixSuggestion.steps) {
      lines.push(`  - ${step}`);
    }
  }
  return lines.join("\n");
}

function severityIcon(severity: AuditIssue["severity"]): string {
  switch (severity) {
    case "critical": return "🔴";
    case "serious": return "🟠";
    case "moderate": return "🟡";
    case "minor": return "🔵";
  }
}
