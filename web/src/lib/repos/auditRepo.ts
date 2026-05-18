/**
 * auditRepo.ts — AuditRepository
 *
 * Domain repository for audit_runs and checklist_results tables.
 * All public methods map camelCase TypeScript inputs to snake_case SQL columns.
 */

import { BaseRepository } from "./base";

// ── Input / output types ──────────────────────────────────────────────────────

export interface CreateAuditRunInput {
  projectId: string;
  designContextVersionId?: string;
  source: string;
  overallScore?: number;
  status?: string;
}

export interface UpdateAuditRunInput {
  overallScore?: number;
  status?: string;
}

export interface CreateChecklistResultInput {
  auditRunId: string;
  checkId: string;
  status: string;
  score: number;
  severity?: string;
  confidence?: number;
  reason?: string;
  fixSuggestion?: unknown;
}

// Row shapes returned from Supabase (snake_case mirrors the DB columns)
export interface AuditRunRow {
  id: string;
  project_id: string;
  design_context_version_id: string | null;
  source: string;
  overall_score: number | null;
  status: string;
  created_at: string;
}

export interface ChecklistResultRow {
  id: string;
  audit_run_id: string;
  check_id: string;
  status: string;
  score: number;
  severity: string | null;
  confidence: number | null;
  reason: string | null;
  fix_suggestion: unknown | null;
  created_at: string;
}

export interface AuditRunWithResults extends AuditRunRow {
  checklist_results: ChecklistResultRow[];
}

// ── Repository ────────────────────────────────────────────────────────────────

export class AuditRepository extends BaseRepository {
  /** Insert a new audit_runs record. Returns the created row. */
  async createRun(input: CreateAuditRunInput): Promise<AuditRunRow> {
    return this.create<AuditRunRow>("audit_runs", {
      project_id: input.projectId,
      design_context_version_id: input.designContextVersionId ?? null,
      source: input.source,
      overall_score: input.overallScore ?? null,
      status: input.status ?? "running",
    });
  }

  /** Update status and/or overall_score on an existing audit_runs record. */
  async updateRun(id: string, updates: UpdateAuditRunInput): Promise<AuditRunRow> {
    const payload: Record<string, unknown> = {};
    if (updates.overallScore !== undefined) payload.overall_score = updates.overallScore;
    if (updates.status !== undefined) payload.status = updates.status;
    return this.update<AuditRunRow>("audit_runs", id, payload);
  }

  /** List audit runs for a project, newest first. */
  async getRuns(projectId: string): Promise<AuditRunRow[]> {
    return this.findMany<AuditRunRow>("audit_runs", "project_id", projectId);
  }

  /**
   * Fetch a single audit run joined with its checklist_results.
   * Uses a Supabase nested select to avoid N+1 queries.
   */
  async getRunWithResults(id: string): Promise<AuditRunWithResults> {
    const { data, error } = await this.getClient()
      .from("audit_runs")
      .select("*, checklist_results(*)")
      .eq("id", id)
      .single<AuditRunWithResults>();
    if (error) throw error;
    return data;
  }

  /** Batch-insert checklist_results for an audit run. */
  async createResults(
    auditRunId: string,
    results: Omit<CreateChecklistResultInput, "auditRunId">[],
  ): Promise<ChecklistResultRow[]> {
    return this.createMany<ChecklistResultRow>(
      "checklist_results",
      results.map(r => ({
        audit_run_id: auditRunId,
        check_id: r.checkId,
        status: r.status,
        score: r.score,
        severity: r.severity ?? null,
        confidence: r.confidence ?? null,
        reason: r.reason ?? null,
        fix_suggestion: r.fixSuggestion ?? null,
      })),
    );
  }
}
