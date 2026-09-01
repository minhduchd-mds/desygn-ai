/**
 * POST /api/a11y/verify-pdf
 *
 * PUBLIC endpoint — verifies an HMAC-SHA256 signed PDF payload server-side.
 * This endpoint intentionally uses Vercel's default Node.js runtime because
 * report verification relies on node:crypto and the report workspace contains
 * Node-only PDF dependencies.
 */

import { verifyReport } from "@desygn/report-generator";
import { z } from "zod";
import { getClientIdentifier, rateLimit } from "../lib/rate-limit.js";
import { formatZodError, jsonResponse } from "./_shared.js";

const verifyPdfSchema = z.object({
  pdfBase64: z.string().min(1, "pdfBase64 is required"),
  signature: z.string().min(1, "signature is required"),
  metadata: z.record(z.string(), z.unknown()),
});

const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeBase64(input: string): Uint8Array {
  const encoded = input.trim();
  if (!CANONICAL_BASE64.test(encoded)) {
    throw new Error("Invalid base64 payload");
  }
  return new Uint8Array(Buffer.from(encoded, "base64"));
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed. Use POST." }, NO_STORE);
  }

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

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(pdfBase64);
  } catch {
    return jsonResponse(400, { error: "pdfBase64 is not valid base64." }, NO_STORE);
  }

  try {
    const valid = verifyReport(bytes, metadata, signature);
    return jsonResponse(200, { valid }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed.";
    return jsonResponse(500, { error: message }, NO_STORE);
  }
}

export default handler;
export { verifyPdfSchema };
