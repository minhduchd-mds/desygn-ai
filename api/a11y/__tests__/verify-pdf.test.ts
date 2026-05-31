/**
 * verify-pdf — unit tests for the public PDF verification endpoint.
 *
 * Deterministic + offline: no Redis (rateLimit gracefully degrades to
 * allow-all when env vars are unset), no Supabase, no network. We exercise
 * the method gate, the JSON/zod validation, and a full signReport round-trip
 * to prove both the "tampered" and "valid" paths return the right shape.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signReport } from "@desygn/report-generator";
import verifyPdfHandler, { verifyPdfSchema } from "../verify-pdf.js";

const SECRET = "test-secret-32-bytes-long-padding!!";
const ENDPOINT = "http://x/api/a11y/verify-pdf";

/** Encode a Uint8Array as base64 in a Node-friendly way. */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

describe("verify-pdf handler", () => {
  const previousSecret = process.env.REPORT_SIGNING_SECRET;

  beforeAll(() => {
    process.env.REPORT_SIGNING_SECRET = SECRET;
  });

  afterAll(() => {
    // Restore whatever was there before the test (usually undefined).
    if (previousSecret === undefined) {
      delete process.env.REPORT_SIGNING_SECRET;
    } else {
      process.env.REPORT_SIGNING_SECRET = previousSecret;
    }
  });

  it("returns 405 on GET", async () => {
    const res = await verifyPdfHandler(new Request(ENDPOINT, { method: "GET" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await verifyPdfHandler(
      new Request(ENDPOINT, {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Invalid JSON/i);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await verifyPdfHandler(
      new Request(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ pdfBase64: "" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: string[] };
    expect(body.error).toMatch(/Invalid request body/i);
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("returns 400 when pdfBase64 is not valid base64", async () => {
    const res = await verifyPdfHandler(
      new Request(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          pdfBase64: "@@@not-base64@@@",
          signature: "anything",
          metadata: {},
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/base64/i);
  });

  it("returns 200 { valid: false } when the signature is tampered", async () => {
    const bytes = new TextEncoder().encode("hello world");
    const metadata = { auditId: "abc", score: 87 };
    const { signature } = signReport(bytes, metadata, SECRET);
    // Decode → flip one bit → re-encode. Guarantees a same-length, valid
    // base64 string that decodes to a *different* HMAC byte sequence, so
    // timingSafeEqual returns false regardless of the original signature.
    const sigBytes = Buffer.from(signature, "base64");
    sigBytes[0] = sigBytes[0] ^ 0xff;
    const tampered = sigBytes.toString("base64");

    const res = await verifyPdfHandler(
      new Request(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          pdfBase64: toBase64(bytes),
          signature: tampered,
          metadata,
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
  });

  it("returns 200 { valid: true } after a real signReport round-trip", async () => {
    const bytes = new TextEncoder().encode("a fake but signed pdf payload");
    const metadata = { auditId: "round-trip", score: 92, reportFormat: "pdf" };
    const { signature } = signReport(bytes, metadata, SECRET);

    const res = await verifyPdfHandler(
      new Request(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          pdfBase64: toBase64(bytes),
          signature,
          metadata,
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ valid: true });
  });
});

describe("verifyPdfSchema", () => {
  it("requires pdfBase64, signature, and metadata", () => {
    expect(verifyPdfSchema.safeParse({}).success).toBe(false);
    expect(
      verifyPdfSchema.safeParse({ pdfBase64: "a", signature: "b", metadata: {} }).success,
    ).toBe(true);
  });
});
