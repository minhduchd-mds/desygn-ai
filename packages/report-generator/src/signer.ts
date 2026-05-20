/**
 * signer — HMAC-SHA256 signature for tamper-proof PDF/JSON reports.
 *
 * For compliance use (EU Accessibility Act, ADA), reports must be
 * verifiable as unmodified and traceable to a generation timestamp.
 *
 * Verification page at /verify accepts signature + payload and confirms
 * authenticity by recomputing HMAC and timingSafeEqual comparison.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ReportSignature {
  signature: string;
  signedAt: string;
  signedBy: string;
  algorithm: "HMAC-SHA256";
  verificationUrl: string;
}

const PRODUCT_VERSION = "Desygn A11y v0.1.0";
const VERIFICATION_BASE = process.env.A11Y_VERIFICATION_URL ?? "https://a11y.desygn.ai/verify";

/** Sign a buffer + canonical metadata blob. Returns base64 HMAC signature. */
export function signReport(
  payload: Buffer | Uint8Array | string,
  metadata: Record<string, unknown>,
  secret: string = process.env.REPORT_SIGNING_SECRET ?? "",
): ReportSignature {
  if (!secret) {
    throw new Error("REPORT_SIGNING_SECRET env var is required to sign reports");
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(typeof payload === "string" ? Buffer.from(payload, "utf-8") : Buffer.from(payload));
  hmac.update(JSON.stringify(metadata, Object.keys(metadata).sort()));

  const signature = hmac.digest("base64");

  return {
    signature,
    signedAt: new Date().toISOString(),
    signedBy: PRODUCT_VERSION,
    algorithm: "HMAC-SHA256",
    verificationUrl: `${VERIFICATION_BASE}?sig=${encodeURIComponent(signature)}`,
  };
}

/** Verify a payload's HMAC signature. Constant-time comparison. */
export function verifyReport(
  payload: Buffer | Uint8Array | string,
  metadata: Record<string, unknown>,
  expectedSignature: string,
  secret: string = process.env.REPORT_SIGNING_SECRET ?? "",
): boolean {
  if (!secret) return false;

  const expected = signReport(payload, metadata, secret).signature;
  const expectedBuf = Buffer.from(expected, "base64");
  const providedBuf = Buffer.from(expectedSignature, "base64");

  if (expectedBuf.length !== providedBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
