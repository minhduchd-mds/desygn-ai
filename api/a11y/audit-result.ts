/**
 * GET /api/a11y/audit-result?id=<auditRunId>
 *
 * Fetch a persisted audit run and its issues.
 * Uses Vercel's default Node.js runtime because the shared audit workspace
 * contains Node-only report/signing dependencies that are not Edge-safe.
 */

import { authenticate, AuthError } from "../lib/auth.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { auditResultQuerySchema, errorResponse, jsonResponse } from "./_shared.js";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "Method not allowed. Use GET.");
  }

  let auth;
  try {
    auth = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, err.message);
    return errorResponse(401, "Authentication failed");
  }

  const id = new URL(req.url).searchParams.get("id");
  const parsed = auditResultQuerySchema.safeParse({ id });
  if (!parsed.success) {
    return errorResponse(400, "An 'id' query parameter is required.");
  }
  const auditRunId = parsed.data.id;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return errorResponse(503, "Audit backend not configured");
  }

  const { data: run, error: runError } = await admin
    .from("audit_runs")
    .select("*")
    .eq("id", auditRunId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (runError) return errorResponse(500, "Failed to read audit run.");
  if (!run) return errorResponse(404, "Audit run not found.");

  const { data: issues, error: issuesError } = await admin
    .from("audit_issues")
    .select("*")
    .eq("audit_run_id", auditRunId);

  if (issuesError) return errorResponse(500, "Failed to read audit issues.");

  return jsonResponse(
    200,
    { run, issues: issues ?? [] },
    { "Cache-Control": "private, max-age=3600" },
  );
}

export default handler;
