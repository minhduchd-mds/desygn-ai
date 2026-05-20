/**
 * pdf — Render audit result as a PDF document via @react-pdf/renderer.
 *
 * Two entry points:
 *   - generatePdfReport    → raw PDF bytes (Buffer)
 *   - generateSignedPdfReport → PDF + HMAC signature over the bytes,
 *     for EU Accessibility Act / ADA compliance verification.
 *
 * Pro+ reports omit the watermark; free-tier reports pass `watermark: true`.
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { AuditResult, AuditIssue, Severity } from "@desygn/audit-engine";
import { signReport, type ReportSignature } from "./signer.js";

export interface PdfOptions {
  branding?: { companyName?: string };
  watermark?: boolean;
}

/** Cap on the number of issues rendered to keep PDFs a sane size. */
const MAX_ISSUES = 30;

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 10,
    color: "#1a1a1a",
    fontFamily: "Helvetica",
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555555", marginBottom: 2 },
  meta: { fontSize: 10, color: "#333333", marginBottom: 1 },
  score: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 10 },
  sectionHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  table: { borderTopWidth: 1, borderColor: "#dddddd" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#dddddd",
    paddingVertical: 3,
  },
  cellLabel: { width: "70%" },
  cellValue: { width: "30%", textAlign: "right" },
  totalLabel: { width: "70%", fontFamily: "Helvetica-Bold" },
  totalValue: { width: "30%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  issue: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: "#eeeeee",
  },
  issueHeader: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  issueMeta: { fontSize: 9, color: "#555555" },
  issueMessage: { fontSize: 9, marginTop: 2 },
  moreNote: { fontSize: 9, color: "#777777", marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999999",
    borderTopWidth: 1,
    borderColor: "#eeeeee",
    paddingTop: 6,
  },
});

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#c0392b",
  serious: "#e67e22",
  moderate: "#d4a017",
  minor: "#2980b9",
};

function severityColor(severity: Severity): string {
  return SEVERITY_COLORS[severity] ?? "#1a1a1a";
}

/** Build the react-pdf document element for an audit result. */
function ReportDocument({
  audit,
  options,
}: {
  audit: AuditResult;
  options: PdfOptions;
}): React.ReactElement {
  const company = options.branding?.companyName;
  const title = company
    ? `${company} — Accessibility Audit Report`
    : "Accessibility Audit Report";
  const issues = audit.issues.slice(0, MAX_ISSUES);
  const hiddenCount = audit.issues.length - issues.length;

  return (
    <Document title={title}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Generated: {new Date().toISOString()}</Text>
        <Text style={styles.meta}>
          WCAG Version: {audit.wcagVersion} {audit.wcagLevel}
        </Text>
        <Text style={styles.meta}>Nodes evaluated: {audit.nodeCount}</Text>
        <Text style={styles.score}>Score: {audit.score}/100</Text>

        <Text style={styles.sectionHeading}>Summary</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Critical</Text>
            <Text style={styles.cellValue}>{audit.summary.critical}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Serious</Text>
            <Text style={styles.cellValue}>{audit.summary.serious}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Moderate</Text>
            <Text style={styles.cellValue}>{audit.summary.moderate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Minor</Text>
            <Text style={styles.cellValue}>{audit.summary.minor}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{audit.summary.total}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Issues</Text>
        {issues.map((issue: AuditIssue) => (
          <View key={issue.id} style={styles.issue} wrap={false}>
            <Text style={[styles.issueHeader, { color: severityColor(issue.severity) }]}>
              [{issue.severity.toUpperCase()}] {issue.ruleId}
            </Text>
            <Text style={styles.issueMeta}>
              WCAG {issue.wcagCriterion} · {issue.nodeName} ({issue.nodeType})
              {issue.pageName ? ` · ${issue.pageName}` : ""}
            </Text>
            <Text style={styles.issueMessage}>{issue.message}</Text>
          </View>
        ))}
        {hiddenCount > 0 ? (
          <Text style={styles.moreNote}>
            …and {hiddenCount} more issue{hiddenCount === 1 ? "" : "s"} not shown.
          </Text>
        ) : null}

        {options.watermark ? (
          <Text style={styles.footer} fixed>
            Powered by Desygn A11y — https://a11y.desygn.ai
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}

/**
 * Render an audit result to PDF bytes.
 * @returns a Node Buffer beginning with the `%PDF` magic bytes.
 */
export async function generatePdfReport(
  audit: AuditResult,
  opts: PdfOptions = {},
): Promise<Buffer> {
  return renderToBuffer(<ReportDocument audit={audit} options={opts} />);
}

/**
 * Render an audit result to PDF and HMAC-sign the resulting bytes.
 *
 * The signature covers the raw PDF buffer plus a minimal, canonical
 * metadata blob so the report can be verified as unmodified via
 * `verifyReport(pdf, metadata, signature.signature, secret)`.
 */
export async function generateSignedPdfReport(
  audit: AuditResult,
  secret: string,
  opts: PdfOptions = {},
): Promise<{ pdf: Buffer; signature: ReportSignature }> {
  const pdf = await generatePdfReport(audit, opts);
  const signedAt = new Date().toISOString();
  const signature = signReport(
    pdf,
    { auditId: audit.id, score: audit.score, signedAt },
    secret,
  );
  // Pin the signature's `signedAt` to the exact value baked into the signed
  // metadata so callers can reconstruct identical metadata for verification.
  return { pdf, signature: { ...signature, signedAt } };
}
