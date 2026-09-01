/**
 * POST /api/a11y/audit-start
 *
 * Run a synchronous WCAG accessibility audit and persist the result.
 * Uses Vercel's default Node.js runtime because the audit workspace may load
 * Node-only report/signing dependencies and the Figma/audit pipeline benefits
 * from the full Node runtime.
 */

import { createDefaultEngine } from "@desygn/audit-engine";
import type { AuditNode } from "@desygn/audit-engine";
import { FigmaRestClient, transformFigmaToAuditNodes } from "@desygn/figma-rest-adapter";
import { authenticate, AuthError } from "../lib/auth.js";
import { checkQuota, recordUsage } from "../lib/quota.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import {
  auditStartSchema,
  errorResponse,
  formatZodError,
  jsonResponse,
  resolveAuditOptions,
} from "./_shared.js";

export const config = { maxDuration: 60 };

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  let auth;
  try {
    auth = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, err.message);
    return errorResponse(401, "Authentication failed");
  }

  const quota = await checkQuota(auth.userId, auth.tier, "audit");
  if (!quota.allowed) {
    return errorResponse(402, "Audit quota exceeded for your plan.", {
      remaining: 0,
      resetAt: quota.resetAt.toISOString(),
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON body.");
  }

  const parsed = auditStartSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "Invalid request body.", {
      details: formatZodError(parsed.error),
    });
  }
  const body = parsed.data;

  let nodes: AuditNode[];
  try {
    if (body.source === "figma") {
      const { fileKey, nodeId, accessToken } = body.figma!;
      const client = new FigmaRestClient(accessToken);
      const file = await client.getFile(fileKey, nodeId ? [nodeId] : undefined);
      nodes = transformFigmaToAuditNodes(file.document);
    } else {
      nodes = body.nodes!;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load design source.";
    return errorResponse(502, `Could not load design source: ${message}`);
  }

  if (nodes.length === 0) {
    return errorResponse(400, "No auditable nodes were found in the provided source.");
  }

  const options = resolveAuditOptions(body.options);
  let result;
  try {
    result = await createDefaultEngine().run({ nodes, options });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit engine error.";
    return errorResponse(500, `Audit failed: ${message}`);
  }

  const auditRunId = result.id;
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      await admin.from("audit_runs").insert({
        id: auditRunId,
        user_id: auth.userId,
        source: body.source,
        figma_file_key: body.source === "figma" ? body.figma!.fileKey : null,
        figma_node_id: body.source === "figma" ? (body.figma!.nodeId ?? null) : null,
        score: result.score,
        wcag_version: result.wcagVersion,
        wcag_level: result.wcagLevel,
        node_count: result.nodeCount,
        summary: result.summary,
        duration_ms: result.durationMs,
        status: "completed",
      });

      if (result.issues.length > 0) {
        await admin.from("audit_issues").insert(
          result.issues.map((issue) => ({
            audit_run_id: auditRunId,
            rule_id: issue.ruleId,
            wcag_criterion: issue.wcagCriterion,
            category: issue.category,
            severity: issue.severity,
            node_id: issue.nodeId,
            node_name: issue.nodeName,
            node_type: issue.nodeType,
            page_name: issue.pageName ?? null,
            message: issue.message,
            expected: issue.expected ?? null,
            observed: issue.observed ?? null,
            fix_suggestion: issue.fixSuggestion ?? null,
          })),
        );
      }
    } catch (err) {
      console.error("[audit-start] persistence failed:", err instanceof Error ? err.message : err);
    }
  }

  await recordUsage(auth.userId, "audit", { auditRunId, source: body.source });

  return jsonResponse(200, {
    auditRunId,
    score: result.score,
    summary: result.summary,
    status: "completed",
  });
}

export default handler;
