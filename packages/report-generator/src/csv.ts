/**
 * csv — Render audit issues as CSV for spreadsheet import.
 *
 * RFC 4180-compliant: comma separator, CRLF line endings, double-quote
 * escaping for fields with commas or quotes.
 */

import type { AuditResult } from "@desygn/audit-engine";

const HEADERS = [
  "issue_id",
  "rule_id",
  "wcag_criterion",
  "severity",
  "category",
  "node_id",
  "node_name",
  "node_type",
  "page_name",
  "message",
  "expected",
  "observed",
];

export function generateCsv(audit: AuditResult): string {
  const rows = [HEADERS.map(escapeField).join(",")];

  for (const issue of audit.issues) {
    const row = [
      issue.id,
      issue.ruleId,
      issue.wcagCriterion,
      issue.severity,
      issue.category,
      issue.nodeId,
      issue.nodeName,
      issue.nodeType,
      issue.pageName ?? "",
      issue.message,
      issue.expected ?? "",
      issue.observed ?? "",
    ].map(escapeField).join(",");

    rows.push(row);
  }

  return rows.join("\r\n");
}

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
