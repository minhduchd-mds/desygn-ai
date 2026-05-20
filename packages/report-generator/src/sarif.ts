/**
 * sarif — SARIF v2.1.0 format for GitHub Code Scanning.
 *
 * Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 *
 * Used by GitHub Action to upload findings to the Security tab.
 */

import type { AuditResult, AuditIssue } from "@desygn/audit-engine";

const PRODUCT_VERSION = "0.1.0";
const INFORMATION_URI = "https://github.com/minhduchd-mds/desygn-ai";

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: SarifDriver };
  results: SarifResult[];
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  helpUri: string;
  defaultConfiguration: { level: "error" | "warning" | "note" | "none" };
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note" | "none";
  message: { text: string };
  locations: Array<{
    logicalLocations: Array<{ name: string; kind: string }>;
  }>;
  properties: Record<string, unknown>;
}

export function generateSarif(audit: AuditResult): SarifLog {
  // Collect unique rules referenced
  const ruleIds = new Set(audit.issues.map((i) => i.ruleId));
  const rules: SarifRule[] = [...ruleIds].map((id) => {
    const sample = audit.issues.find((i) => i.ruleId === id)!;
    return {
      id,
      name: id,
      shortDescription: { text: `WCAG ${sample.wcagCriterion}` },
      helpUri: `https://www.w3.org/WAI/WCAG22/Understanding/${slug(sample.wcagCriterion)}`,
      defaultConfiguration: { level: severityToLevel(sample.severity) },
    };
  });

  const results: SarifResult[] = audit.issues.map((issue) => ({
    ruleId: issue.ruleId,
    level: severityToLevel(issue.severity),
    message: { text: issue.message },
    locations: [
      {
        logicalLocations: [
          {
            name: issue.nodeName,
            kind: "component",
          },
        ],
      },
    ],
    properties: {
      wcagCriterion: issue.wcagCriterion,
      severity: issue.severity,
      nodeId: issue.nodeId,
      pageName: issue.pageName,
      expected: issue.expected,
      observed: issue.observed,
    },
  }));

  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "Desygn A11y",
            version: PRODUCT_VERSION,
            informationUri: INFORMATION_URI,
            rules,
          },
        },
        results,
      },
    ],
  };
}

function severityToLevel(severity: AuditIssue["severity"]): SarifResult["level"] {
  switch (severity) {
    case "critical":
    case "serious":
      return "error";
    case "moderate":
      return "warning";
    case "minor":
      return "note";
  }
}

function slug(criterion: string): string {
  // "1.4.3" → "contrast-minimum" — for now keep as fragment ID
  return criterion.replace(/\./g, "-");
}
