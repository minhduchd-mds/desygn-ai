/**
 * GET /api/a11y/audit-status?id=<auditRunId>
 *
 * Lightweight status poll for a single audit run.
 * Uses Vercel's default Node.js runtime because the shared audit workspace
 * contains Node-only report/signing dependencies that are not Edge-safe.
 */

import { z } from "zod";
import { authenticate, AuthError } from "../lib/auth.js";
import { rateLimit } from "../lib/rate-limit.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { formatZodError, jsonResponse } from "./_shared.js";

export const auditStatusQuerySchema = z.object({
  id: z.string().uuid("id must be a valid uuid"),
});

const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

export function deriveProgress(status: string | null | undefined): number {
  if (status === "queued") return 0;
  if (status === "completed" || status === "failed") return 100;
  return 50;
}

interface AuditStatusRow {
  id: string;
  project_id: string;
  status: string | null;
  overall_score: number | null;
  created_at: string;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed. Use GET." }, NO_STORE);
  }

  let auth;
  try {
    auth = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonResponse(err.status, { error: err.message }, NO_STORE);
    }
    return jsonResponse(401, { error: "Authentication failed" }, NO_STORE);
  }

  const rl = await rateLimit(`audit-status:${auth.userId}`, 120);
  if (!rl.success) {
    const retryAfter = Math.max(0, rl.reset - Math.floor(Date.now() / 1000));
    return jsonResponse(
      429,
      { error: "Too many requests. Please try again later.", retryAfter },
      NO_STORE,
    );
  }

  const idParam = new URL(req.url).searchParams.get("id");
  if (!idParam) {
    return jsonResponse(400, { error: "An 'id' query parameter is required." }, NO_STORE);
  }

  const parsed = auditStatusQuerySchema.safeParse({ id: idParam });
  if (!parsed.success) {
    return jsonResponse(
      400,
      { error: "Invalid query parameters.", details: formatZodError(parsed.error) },
      NO_STORE,
    );
  }
  const auditRunId = parsed.data.id;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResponse(503, { error: "Backend not configured" }, NO_STORE);
  }

  const { data: ownedVersions, error: versionsError } = await admin
    .from("project_versions")
    .select("id")
    .eq("owner_id", auth.userId);

  if (versionsError) {
    return jsonResponse(500, { error: "Failed to scope audit status." }, NO_STORE);
  }

  const ownedIds: string[] = (ownedVersions ?? []).map((row: { id: string }) => row.id);
  if (ownedIds.length === 0) {
    return jsonResponse(404, { error: "Audit run not found." }, NO_STORE);
  }

  const { data: run, error } = await admin
    .from("audit_runs")
    .select("id, project_id, status, overall_score, created_at")
    .eq("id", auditRunId)
    .in("project_id", ownedIds)
    .maybeSingle();

  if (error) {
    return jsonResponse(500, { error: "Failed to read audit status." }, NO_STORE);
  }
  if (!run) {
    return jsonResponse(404, { error: "Audit run not found." }, NO_STORE);
  }

  const row = run as AuditStatusRow;
  const progress = deriveProgress(row.status);
  const body: {
    status: string | null;
    progress: number;
    score?: number;
    completedAt?: string;
  } = {
    status: row.status,
    progress,
  };
  if (row.overall_score !== null && row.overall_score !== undefined) {
    body.score = row.overall_score;
  }
  if (row.status === "completed" || row.status === "failed") {
    body.completedAt = row.created_at;
  }

  return jsonResponse(200, body, NO_STORE);
}

export default handler;
