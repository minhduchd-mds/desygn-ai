/**
 * auditRunner — Inngest function that runs a WCAG audit asynchronously.
 *
 * Triggered by the `audit/start` event (typically fired from
 * /api/a11y/audit-start when the run is too heavy for the Vercel 30s
 * budget). Each side-effect is wrapped in `step.run` so Inngest can
 * retry individual steps without re-paying for the whole audit.
 *
 * Degradation:
 *   - When Supabase env is missing, `getSupabaseAdmin()` returns null
 *     and we no-op the status / save steps (same pattern as the sync
 *     /api/a11y/audit-start handler).
 *
 * Failure handling:
 *   - Any thrown error inside a step is re-raised after a best-effort
 *     `status = "failed"` write, so Inngest's automatic retry kicks in
 *     (up to the function-level `retries: 3`).
 *
 * Pure helper `mapIssuesToRows` is exported so unit tests can exercise
 * the row-shape contract without spinning up the Inngest runtime.
 */

import {
  createDefaultEngine,
  type AuditIssue,
  type AuditNode,
  type AuditOptions,
} from "@desygn/audit-engine";
import {
  FigmaRestClient,
  transformFigmaToAuditNodes,
} from "@desygn/figma-rest-adapter";
import { getSupabaseAdmin } from "../../api/lib/supabase-admin.js";
import { inngest } from "../client.js";

// ─── Pure helper: issue → DB row mapping ─────────────────────────────

/** Shape of a row inserted into `audit_issues`. */
export interface AuditIssueRow {
  audit_run_id: string;
  rule_id: string;
  wcag_criterion: string;
  severity: AuditIssue["severity"];
  node_id: string;
  node_name: string;
  node_type: string;
  page_name: string | null;
  message: string;
  expected: string | null;
  observed: string | null;
  /** JSON column — stored as the structured object (Supabase serializes). */
  fix_suggestion: AuditIssue["fixSuggestion"] | null;
}

/**
 * Map audit-engine issues to the row shape expected by the
 * `audit_issues` table. Pure — no DB access, safe to unit-test.
 */
export function mapIssuesToRows(
  auditRunId: string,
  issues: AuditIssue[],
): AuditIssueRow[] {
  return issues.map((issue) => ({
    audit_run_id: auditRunId,
    rule_id: issue.ruleId,
    wcag_criterion: issue.wcagCriterion,
    severity: issue.severity,
    node_id: issue.nodeId,
    node_name: issue.nodeName,
    node_type: issue.nodeType,
    page_name: issue.pageName ?? null,
    message: issue.message,
    expected: issue.expected ?? null,
    observed: issue.observed ?? null,
    fix_suggestion: issue.fixSuggestion ?? null,
  }));
}

// ─── Inngest function ───────────────────────────────────────────────

interface FigmaFileResult {
  document: unknown;
}

export const auditRunner = inngest.createFunction(
  {
    id: "audit-runner",
    retries: 3,
    concurrency: { limit: 10, key: "event.data.userId" },
  },
  { event: "audit/start" },
  async ({ event, step }) => {
    const { auditRunId, figma, options } = event.data;

    try {
      // 1. Mark the run as "running" (no-op when Supabase isn't configured) ──
      await step.run("update-status-running", async () => {
        const admin = getSupabaseAdmin();
        if (!admin) return { skipped: true } as const;
        await admin
          .from("audit_runs")
          .update({ status: "running" })
          .eq("id", auditRunId);
        return { skipped: false } as const;
      });

      // 2. Fetch the Figma file (or subtree) ─────────────────────────────────
      const figmaFile = await step.run("fetch-figma", async () => {
        const client = new FigmaRestClient(figma.accessToken);
        const file = await client.getFile(
          figma.fileKey,
          figma.nodeId ? [figma.nodeId] : undefined,
        );
        return { document: file.document } as FigmaFileResult;
      });

      // 3. Transform Figma document → AuditNode tree ─────────────────────────
      const nodes = await step.run("transform", async () => {
        const transformed: AuditNode[] = transformFigmaToAuditNodes(
          figmaFile.document,
        );
        return transformed;
      });

      // 4. Run the audit engine ──────────────────────────────────────────────
      const result = await step.run("audit", async () => {
        const auditOptions: AuditOptions = {
          wcagVersion: options.wcagVersion ?? "2.2",
          wcagLevel: options.wcagLevel ?? "AA",
        };
        const engineResult = await createDefaultEngine().run({
          nodes,
          options: auditOptions,
        });
        return engineResult;
      });

      // 5. Persist results (no-op when Supabase isn't configured) ────────────
      await step.run("save", async () => {
        const admin = getSupabaseAdmin();
        if (!admin) return { skipped: true } as const;

        await admin
          .from("audit_runs")
          .update({
            overall_score: result.score,
            audit_duration_ms: result.durationMs,
            node_count: result.nodeCount,
            frame_count: 1,
            status: "completed",
          })
          .eq("id", auditRunId);

        const rows = mapIssuesToRows(auditRunId, result.issues);
        if (rows.length > 0) {
          await admin.from("audit_issues").insert(rows);
        }
        return { skipped: false, inserted: rows.length } as const;
      });

      return {
        auditRunId,
        score: result.score,
        issueCount: result.issues.length,
      };
    } catch (err) {
      // Best-effort: mark the run as failed before re-raising so Inngest
      // retries. The `try` covers the inner steps because step.run
      // throws on failure after exhausting Inngest's own retries.
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          await admin
            .from("audit_runs")
            .update({ status: "failed" })
            .eq("id", auditRunId);
        }
      } catch (writeErr) {
        // Swallow — the original error is what matters for Inngest retry.
        console.error(
          "[audit-runner] failed to mark run as failed:",
          writeErr instanceof Error ? writeErr.message : writeErr,
        );
      }
      throw err;
    }
  },
);
