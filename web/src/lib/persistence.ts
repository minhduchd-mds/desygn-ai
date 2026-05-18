/**
 * persistence.ts — Supabase persistence service layer.
 *
 * Thin typed wrappers around Supabase client for audit data CRUD.
 * All methods validate inputs and return typed results.
 * Re-uses the shared Supabase client from supabase.ts.
 *
 * NOTE: The flat helper functions in this file are DEPRECATED.
 *   Prefer the typed repository classes exported from ./repos:
 *
 *     import { createRepositories } from "./repos";
 *     const { audit, project, github, evidence } = createRepositories();
 *
 * The legacy functions below are kept for backward compatibility and
 * delegate internally to the repository layer.
 */

import { supabase } from "./supabase";
import {
  AuditRepository,
  ProjectRepository,
  GitHubRepository,
  EvidenceRepository,
} from "./repos";

// Re-export repository classes and factory so callers can migrate gradually.
export {
  BaseRepository,
  AuditRepository,
  ProjectRepository,
  GitHubRepository,
  EvidenceRepository,
  createRepositories,
} from "./repos";

// Re-export all repo-level types for downstream consumers.
export type {
  CreateAuditRunInput,
  UpdateAuditRunInput,
  CreateChecklistResultInput,
  AuditRunRow,
  ChecklistResultRow,
  AuditRunWithResults,
  CreateDesignContextInput,
  DesignContextVersionRow,
  CreateGitHubIssueInput,
  CreateGitHubPRInput,
  UpdateIssueStatusInput,
  GitHubIssueRow,
  GitHubPRRow,
  CreateEvidenceArtifactInput,
  CreateAgentRunInput,
  EvidenceArtifactRow,
  AgentRunRow,
} from "./repos";

// ── Lazily-created singletons used by the legacy helpers ─────────────────────

const _audit = new AuditRepository();
const _project = new ProjectRepository();
const _github = new GitHubRepository();
const _evidence = new EvidenceRepository();

// ── Availability guard ────────────────────────────────────────────────────────

export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

// ── Design Context Versions ───────────────────────────────────────────────────
// @deprecated Use ProjectRepository.createDesignContext() instead.

/** @deprecated Use `new ProjectRepository().createDesignContext(input)` */
export async function createDesignContextVersion(
  input: import("./repos").CreateDesignContextInput,
) {
  return _project.createDesignContext(input);
}

/** @deprecated Use `new ProjectRepository().getDesignContexts(projectId)` */
export async function getDesignContextVersions(projectId: string) {
  return _project.getDesignContexts(projectId);
}

// ── Audit Runs ────────────────────────────────────────────────────────────────
// @deprecated Use AuditRepository methods instead.

/** @deprecated Use `new AuditRepository().createRun(input)` */
export async function createAuditRun(
  input: import("./repos").CreateAuditRunInput,
) {
  return _audit.createRun(input);
}

/** @deprecated Use `new AuditRepository().updateRun(id, updates)` */
export async function updateAuditRun(
  id: string,
  updates: { overallScore?: number; status?: string },
) {
  return _audit.updateRun(id, updates);
}

/** @deprecated Use `new AuditRepository().getRuns(projectId)` */
export async function getAuditRuns(projectId: string) {
  return _audit.getRuns(projectId);
}

// ── Checklist Results ─────────────────────────────────────────────────────────
// @deprecated Use AuditRepository.createResults() instead.

/** @deprecated Use `new AuditRepository().createResults(auditRunId, results)` */
export async function createChecklistResults(
  inputs: import("./repos").CreateChecklistResultInput[],
) {
  if (!inputs.length) return [];
  const auditRunId = inputs[0].auditRunId;
  return _audit.createResults(
    auditRunId,
    inputs.map(({ auditRunId: _id, ...rest }) => rest),
  );
}

// ── Evidence Artifacts ────────────────────────────────────────────────────────
// @deprecated Use EvidenceRepository.createArtifacts() instead.

/** @deprecated Use `new EvidenceRepository().createArtifacts(inputs)` */
export async function createEvidenceArtifacts(
  inputs: import("./repos").CreateEvidenceArtifactInput[],
) {
  return _evidence.createArtifacts(inputs);
}

// ── GitHub Issues ─────────────────────────────────────────────────────────────
// @deprecated Use GitHubRepository.createIssue() instead.

/** @deprecated Use `new GitHubRepository().createIssue(input)` */
export async function createGitHubIssueRecord(
  input: import("./repos").CreateGitHubIssueInput,
) {
  return _github.createIssue(input);
}

// ── Agent Runs ────────────────────────────────────────────────────────────────
// @deprecated Use EvidenceRepository.createAgentRun() instead.

/** @deprecated Use `new EvidenceRepository().createAgentRun(input)` */
export async function createAgentRun(
  input: import("./repos").CreateAgentRunInput,
) {
  return _evidence.createAgentRun(input);
}

// ── Full Audit with Evidence (composite) ──────────────────────────────────────

export interface FullAuditResult {
  checkId: string;
  status: string;
  score: number;
  severity?: string;
  confidence?: number;
  reason?: string;
  fixSuggestion?: unknown;
  evidence?: import("./repos").CreateEvidenceArtifactInput[];
}

/**
 * Convenience transaction-like helper that:
 *   1. Creates an audit_runs record (status = "completed")
 *   2. Batch-inserts all checklist_results
 *   3. Batch-inserts evidence_artifacts per result
 *
 * @deprecated Build the same flow with the individual repo methods for
 *   finer error-handling and retry control.
 */
export async function persistFullAudit(
  projectId: string,
  source: string,
  overallScore: number,
  results: FullAuditResult[],
  designContextVersionId?: string,
) {
  // 1. Create audit run
  const auditRun = await _audit.createRun({
    projectId,
    designContextVersionId,
    source,
    overallScore,
    status: "completed",
  });

  // 2. Batch-insert checklist results
  const checklistResults = await _audit.createResults(
    auditRun.id,
    results.map(r => ({
      checkId: r.checkId,
      status: r.status,
      score: r.score,
      severity: r.severity,
      confidence: r.confidence,
      reason: r.reason,
      fixSuggestion: r.fixSuggestion,
    })),
  );

  // 3. Batch-insert evidence artifacts per result
  for (const [idx, result] of results.entries()) {
    if (result.evidence && result.evidence.length > 0) {
      await _evidence.createArtifacts(
        result.evidence.map(e => ({
          ...e,
          checklistResultId: checklistResults[idx].id,
        })),
      );
    }
  }

  return { auditRun, checklistResults };
}
