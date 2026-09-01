/**
 * GET /api/a11y/audit-list?cursor=&limit=&projectId=
 *
 * List the authenticated user's audit runs, newest first, with cursor-based
 * pagination keyed on `(created_at, id)`.
 */

import { z } from "zod";
import { authenticate, AuthError } from "../lib/auth.js";
import { rateLimit } from "../lib/rate-limit.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { errorResponse, formatZodError, jsonResponse } from "./_shared.js";
import { decodeCursor, encodeCursor } from "./_pagination.js";

/**
 * Intentionally uses Vercel's default Node.js runtime.
 * The shared audit workspace contains Node-only report/signing dependencies;
 * forcing this endpoint onto Edge makes Vercel trace unsupported modules.
 */

export const auditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().min(1).optional(),
  projectId: z.string().uuid().optional(),
});

interface AuditListRow {
  id: string;
  project_id: string;
  status: string;
  overall_score: number | null;
  wcag_version: string | null;
  wcag_level: string | null;
  figma_file_key: string | null;
  audit_duration_ms: number | null;
  created_at: string;
}

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

  const rl = await rateLimit(`audit-list:${auth.userId}`, 60);
  if (!rl.success) {
    const retryAfter = Math.max(0, rl.reset - Math.floor(Date.now() / 1000));
    return errorResponse(429, "Too many requests. Please try again later.", {
      retryAfter,
    });
  }

  const url = new URL(req.url);
  const rawQuery = {
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
  };
  const parsed = auditListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return errorResponse(400, "Invalid query parameters.", {
      details: formatZodError(parsed.error),
    });
  }
  const { limit, cursor: rawCursor, projectId } = parsed.data;

  let cursor: { t: string; i: string } | null = null;
  if (rawCursor) {
    cursor = decodeCursor(rawCursor);
    if (!cursor) return errorResponse(400, "Invalid cursor.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) return errorResponse(503, "Backend not configured");

  const { data: ownedVersions, error: versionsError } = await admin
    .from("project_versions")
    .select("id")
    .eq("owner_id", auth.userId);

  if (versionsError) return errorResponse(500, "Failed to scope audit list.");

  const ownedIds: string[] = (ownedVersions ?? []).map((row: { id: string }) => row.id);
  if (ownedIds.length === 0) {
    return jsonResponse(
      200,
      { items: [], nextCursor: null, hasMore: false },
      { "Cache-Control": "private, max-age=10" },
    );
  }

  let query = admin
    .from("audit_runs")
    .select(
      "id, project_id, status, overall_score, wcag_version, wcag_level, figma_file_key, audit_duration_ms, created_at",
    )
    .in("project_id", ownedIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (projectId) {
    if (!ownedIds.includes(projectId)) {
      return jsonResponse(
        200,
        { items: [], nextCursor: null, hasMore: false },
        { "Cache-Control": "private, max-age=10" },
      );
    }
    query = query.eq("project_id", projectId);
  }

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.i})`,
    );
  }

  const { data, error } = await query;
  if (error) return errorResponse(500, "Failed to read audit list.");

  const rows: AuditListRow[] = (data ?? []) as AuditListRow[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ t: last.created_at, i: last.id }) : null;

  return jsonResponse(
    200,
    { items, nextCursor, hasMore },
    { "Cache-Control": "private, max-age=10" },
  );
}

export default handler;
