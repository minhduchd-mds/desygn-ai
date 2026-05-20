/**
 * audit_figma_for_a11y — Run a WCAG accessibility audit against a Figma file.
 *
 * Fetches the file via the Figma REST API (using the caller's personal
 * access token), transforms it into audit nodes, runs the default WCAG
 * rule set, and returns a readable markdown summary for the LLM.
 */

import { z } from "zod";
import {
  createDefaultEngine,
  type AuditResult,
} from "@desygn/audit-engine";
import {
  FigmaRestClient,
  transformFigmaToAuditNodes,
  parseFigmaUrl,
} from "@desygn/figma-rest-adapter";

export const AUDIT_FIGMA_SCHEMA = {
  name: "audit_figma_for_a11y",
  description:
    "Run a WCAG accessibility audit on a Figma file or frame. " +
    "Provide a Figma file/design URL and a Figma personal access token. " +
    "Returns an accessibility score, severity breakdown, and the top issues " +
    "(contrast, touch targets, ARIA/roles, headings, motion) with the WCAG " +
    "criterion, offending node, and a description of each problem.",
  inputSchema: {
    type: "object" as const,
    properties: {
      figmaUrl: {
        type: "string",
        description:
          "Figma file or design URL, e.g. https://www.figma.com/design/<key>/<title>?node-id=<id>. " +
          "If a node-id is present, only that frame/subtree is audited.",
      },
      figmaAccessToken: {
        type: "string",
        description:
          "Figma personal access token (X-Figma-Token). Used only for this request; not stored.",
      },
      wcagVersion: {
        type: "string",
        enum: ["2.0", "2.1", "2.2"],
        description: "WCAG version to audit against. Defaults to 2.2.",
      },
      wcagLevel: {
        type: "string",
        enum: ["A", "AA", "AAA"],
        description: "WCAG conformance level. Defaults to AA.",
      },
    },
    required: ["figmaUrl", "figmaAccessToken"],
  },
};

export const auditFigmaInput = z.object({
  figmaUrl: z.string().url(),
  figmaAccessToken: z.string(),
  wcagVersion: z.enum(["2.0", "2.1", "2.2"]).default("2.2"),
  wcagLevel: z.enum(["A", "AA", "AAA"]).default("AA"),
});

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  serious: "Serious",
  moderate: "Moderate",
  minor: "Minor",
};

const MAX_ISSUES = 10;

/**
 * Pure helper: render an AuditResult as a readable markdown summary.
 * No side effects, no I/O.
 */
export function formatAuditForLLM(result: AuditResult): string {
  const { score, summary, wcagVersion, wcagLevel, nodeCount, issues } = result;

  const lines: string[] = [];
  lines.push(`# Accessibility Audit`);
  lines.push("");
  lines.push(`- **Score:** ${score}/100`);
  lines.push(`- **WCAG:** ${wcagVersion} level ${wcagLevel}`);
  lines.push(`- **Nodes evaluated:** ${nodeCount}`);
  lines.push(`- **Total issues:** ${summary.total}`);
  lines.push("");
  lines.push(`## Severity`);
  lines.push(
    `- Critical: ${summary.critical}` +
      ` | Serious: ${summary.serious}` +
      ` | Moderate: ${summary.moderate}` +
      ` | Minor: ${summary.minor}`,
  );
  lines.push("");

  if (issues.length === 0) {
    lines.push(`## Issues`);
    lines.push("");
    lines.push(`No accessibility issues found. 🎉`);
    return lines.join("\n");
  }

  const shown = issues.slice(0, MAX_ISSUES);
  lines.push(`## Top ${shown.length} issue(s)`);
  if (issues.length > shown.length) {
    lines.push("");
    lines.push(`_Showing ${shown.length} of ${issues.length} total issues._`);
  }
  lines.push("");

  for (const [i, issue] of shown.entries()) {
    const sev = SEVERITY_LABEL[issue.severity] ?? issue.severity;
    const page = issue.pageName ? ` — page "${issue.pageName}"` : "";
    lines.push(
      `${i + 1}. **[${sev}] ${issue.ruleId}** (WCAG ${issue.wcagCriterion})`,
    );
    lines.push(`   - Node: "${issue.nodeName}" (${issue.nodeType}, id ${issue.nodeId})${page}`);
    lines.push(`   - ${issue.message}`);
    if (issue.expected) lines.push(`   - Expected: ${issue.expected}`);
    if (issue.observed) lines.push(`   - Observed: ${issue.observed}`);
  }

  return lines.join("\n");
}

export async function handleAuditFigmaForA11y(args: z.infer<typeof auditFigmaInput>) {
  try {
    const { fileKey, nodeId } = parseFigmaUrl(args.figmaUrl);

    const client = new FigmaRestClient(args.figmaAccessToken);
    const file = await client.getFile(fileKey, nodeId ? [nodeId] : undefined);

    const nodes = transformFigmaToAuditNodes(file.document);

    const engine = createDefaultEngine();
    const result = await engine.run({
      nodes,
      options: {
        wcagVersion: args.wcagVersion,
        wcagLevel: args.wcagLevel,
      },
      source: { type: "figma", fileKey, nodeId },
    });

    return {
      content: [{ type: "text" as const, text: formatAuditForLLM(result) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to audit Figma file: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
