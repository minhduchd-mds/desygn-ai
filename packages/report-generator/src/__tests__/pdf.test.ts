/**
 * pdf — signed PDF report generation tests.
 *
 * PDF rendering via @react-pdf/renderer is comparatively slow, so these
 * use a single shared fixture and a generous per-test timeout.
 */

import { describe, it, expect } from "vitest";
import { generatePdfReport, generateSignedPdfReport } from "../pdf.js";
import { verifyReport } from "../signer.js";
import type { AuditResult, AuditIssue } from "@desygn/audit-engine";

const SECRET = "test-secret";

function issue(overrides: Partial<AuditIssue> = {}): AuditIssue {
  return {
    id: "i1",
    ruleId: "contrast.text",
    wcagCriterion: "1.4.3",
    category: "contrast",
    severity: "serious",
    nodeId: "n1",
    nodeName: "Body Text",
    nodeType: "TEXT",
    pageName: "Home",
    message: "Low contrast: text is hard to read against its background.",
    expected: "≥ 4.5:1",
    observed: "3.0:1",
    ...overrides,
  };
}

function fixture(): AuditResult {
  const issues = [
    issue(),
    issue({ id: "i2", severity: "critical", ruleId: "aria.label" }),
    issue({ id: "i3", severity: "minor", ruleId: "touch-target.size" }),
  ];
  return {
    id: "audit-1",
    score: 87,
    issues,
    summary: {
      critical: 1,
      serious: 1,
      moderate: 0,
      minor: 1,
      total: 3,
      byCategory: {
        contrast: 1,
        "touch-target": 1,
        aria: 1,
        keyboard: 0,
        heading: 0,
        motion: 0,
        semantic: 0,
      },
    },
    durationMs: 1234,
    wcagVersion: "2.2",
    wcagLevel: "AA",
    nodeCount: 10,
  };
}

describe("generatePdfReport", () => {
  it("renders a non-empty Buffer starting with the %PDF magic bytes", async () => {
    const buf = await generatePdfReport(fixture(), { watermark: true });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  }, 20000);
});

describe("generateSignedPdfReport", () => {
  it("returns a PDF Buffer plus a base64 signature", async () => {
    const { pdf, signature } = await generateSignedPdfReport(fixture(), SECRET);
    expect(buf4(pdf)).toBe("%PDF");
    expect(signature.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(signature.signature.length).toBeGreaterThan(0);
    expect(signature.algorithm).toBe("HMAC-SHA256");
  }, 20000);

  it("produces a signature that verifyReport accepts for the same metadata", async () => {
    const audit = fixture();
    const { pdf, signature } = await generateSignedPdfReport(audit, SECRET);
    const metadata = {
      auditId: audit.id,
      score: audit.score,
      signedAt: signature.signedAt,
    };
    expect(verifyReport(pdf, metadata, signature.signature, SECRET)).toBe(true);
    // Tampering with the bytes must invalidate the signature.
    const tampered = Buffer.concat([pdf, Buffer.from("x")]);
    expect(verifyReport(tampered, metadata, signature.signature, SECRET)).toBe(false);
  }, 20000);
});

function buf4(b: Buffer): string {
  return b.subarray(0, 4).toString();
}
