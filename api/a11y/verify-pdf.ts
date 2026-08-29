/**
 * POST /api/a11y/verify-pdf
 *
 * PUBLIC endpoint — verifies an HMAC-SHA256 signed PDF payload server-side
 * (where the signing secret lives). The dashboard's /verify page is the
 * primary caller; CI integrations may call it directly.
 *
 * Flow:
 *   1. method check                                  → 405 on non-POST
 *   2. rate-limit by client IP (30 req / 60 s)       → 429 on burst
 *   3. parse + validate JSON body                    → 400 on bad input
 *   4. base64-decode the PDF bytes                   → 400 on bad base64
 *   5. verifyReport(bytes, metadata, signature)      → 200 { valid: bool }
 *   6. any unexpected throw                          → 500
 *
 * The signing secret is read from REPORT_SIGNING_SECRET inside verifyReport;
 * no auth is required to call this endpoint (the secret never leaves the
 * server). When the secret is unset, verifyReport returns false (fails closed).
 */

import { verifyReport } from "@desygn/report-generator";
import { z } from "zod";
import { getClientIdentifier, rateLimit } from "../lib/rate-limit.js";
import { formatZodError, jsonResponse } from "./_shared.js";

export const config = { runtime: "edge" };

/** Shape of the verification request body. */
const verifyPdfSchema = z.object({
  pdfBase64: z.string().min(1, "pdfBase64 is required"),
  signature: z.string().min(1, "signature is required"),
  metadata: z.record(z.string(), z.unknown()),
});

const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

/** Base64 → Uint8Array. Throws on bad input (caller turns it into 400). */
function decodeBase64(input: string): Uint8Array {
  // atob() exists in the Edge runtime; throws DOMException on invalid base64.
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed. Use POST." }, NO_STORE);
  }

  // 1. Rate-limit by IP (PUBLIC endpoint — must throttle bursts) ────
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const ip = getClientIdentifier(headers);
  const rl = await rateLimit(`verify-pdf:${ip}`, 30);
  if (!rl.success) {
    const retryAfter = Math.max(0, rl.reset - Math.floor(Date.now() / 1000));
    return jsonResponse(
      429,
      { error: "Too many requests. Please try again later.", retryAfter },
      { ...NO_STORE, "Retry-After": String(retryAfter) },
    );
  }

  // 2. Parse body ───────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." }, NO_STORE);
  }

  const parsed = verifyPdfSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      400,
      { error: "Invalid request body.", details: formatZodError(parsed.error) },
      NO_STORE,
    );
  }
  const { pdfBase64, signature, metadata } = parsed.data;

  // 3. Decode PDF bytes ─────────────────────────────────────────────
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(pdfBase64);
  } catch {
    return jsonResponse(400, { error: "pdfBase64 is not valid base64." }, NO_STORE);
  }

  // 4. Verify HMAC ──────────────────────────────────────────────────
  try {
    const valid = verifyReport(bytes, metadata, signature);
    return jsonResponse(200, { valid }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed.";
    return jsonResponse(500, { error: message }, NO_STORE);
  }
}

// Keep the bare-handler export so tests can invoke it without wiring.
// (We use a manual rate-limit call rather than withRateLimitEdge so every
// error path carries the no-store header the public verify page relies on.)
export default handler;
// Re-export the schema so unit tests can exercise it without re-declaring.
export { verifyPdfSchema };
