/**
 * Inngest event payload types + validators for Desygn A11y.
 *
 * The single event emitted today is `audit/start` — fired by the
 * /api/a11y/audit-start route when an audit run is too heavy to evaluate
 * inside the Vercel edge 30s budget. The Inngest queue picks it up and
 * runs `auditRunner` (functions/audit-runner.ts).
 *
 * `validateAuditStartPayload` is a PURE helper exposed for unit tests —
 * it never throws, returning a discriminated result instead so callers
 * can map invalid events to a stored "failed" status without crashing
 * the worker.
 */

import { z } from "zod";

// ─── Event payload type ──────────────────────────────────────────────

export interface AuditStartEvent {
  name: "audit/start";
  data: {
    auditRunId: string;
    userId: string;
    tier: "free" | "pro" | "team" | "enterprise";
    source: "figma";
    figma: {
      fileKey: string;
      nodeId?: string;
      accessToken: string;
    };
    options: {
      wcagVersion?: "2.0" | "2.1" | "2.2";
      wcagLevel?: "A" | "AA" | "AAA";
    };
  };
}

// ─── Validator ───────────────────────────────────────────────────────

const auditStartDataSchema = z.object({
  auditRunId: z.string().min(1, "auditRunId is required"),
  userId: z.string().min(1, "userId is required"),
  tier: z.enum(["free", "pro", "team", "enterprise"]),
  source: z.literal("figma"),
  figma: z.object({
    fileKey: z.string().min(1, "figma.fileKey is required"),
    nodeId: z.string().optional(),
    accessToken: z.string().min(1, "figma.accessToken is required"),
  }),
  options: z.object({
    wcagVersion: z.enum(["2.0", "2.1", "2.2"]).optional(),
    wcagLevel: z.enum(["A", "AA", "AAA"]).optional(),
  }),
});

export type AuditStartData = AuditStartEvent["data"];

export type ValidationResult =
  | { ok: true; value: AuditStartData }
  | { ok: false; error: string };

/**
 * Validate an arbitrary `audit/start` event payload (`event.data`).
 *
 * Pure — never throws. The caller stores the audit run as "failed" when
 * `ok` is false rather than letting Inngest retry on bad input.
 */
export function validateAuditStartPayload(data: unknown): ValidationResult {
  const parsed = auditStartDataSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    const message = first?.message ?? "invalid payload";
    return {
      ok: false,
      error: path ? `${path}: ${message}` : message,
    };
  }
  return { ok: true, value: parsed.data };
}
