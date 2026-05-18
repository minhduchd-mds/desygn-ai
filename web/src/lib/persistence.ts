/**
 * persistence.ts — Supabase persistence service layer.
 *
 * Thin typed wrappers around Supabase client for audit data CRUD.
 * All methods validate inputs and return typed results.
 * Re-uses the shared Supabase client from supabase.ts.
 */

import { supabase } from "./supabase";

export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

// ── Design Context Versions ──

export interface CreateDesignContextInput {
  projectId: string;
  source: string;
  sourceRef?: string;
  versionNumber: number;
  contextJson: unknown;
  checksum?: string;
}

export async function createDesignContextVersion(input: CreateDesignContextInput) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("design_context_versions")
    .insert({
      project_id: input.projectId,
      source: input.source,
      source_ref: input.sourceRef,
      version_number: input.versionNumber,
      context_json: input.contextJson,
      checksum: input.checksum,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDesignContextVersions(projectId: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("design_context_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ── Audit Runs ──

export interface CreateAuditRunInput {
  projectId: string;
  designContextVersionId?: string;
  source: string;
  overallScore?: number;
  status?: string;
}

export async function createAuditRun(input: CreateAuditRunInput) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("audit_runs")
    .insert({
      project_id: input.projectId,
      design_context_version_id: input.designContextVersionId,
      source: input.source,
      overall_score: input.overallScore,
      status: input.status ?? "running",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAuditRun(id: string, updates: { overallScore?: number; status?: string }) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("audit_runs")
    .update({
      overall_score: updates.overallScore,
      status: updates.status,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAuditRuns(projectId: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("audit_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ── Checklist Results ──

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

export async function createChecklistResults(inputs: CreateChecklistResultInput[]) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("checklist_results")
    .insert(inputs.map(i => ({
      audit_run_id: i.auditRunId,
      check_id: i.checkId,
      status: i.status,
      score: i.score,
      severity: i.severity,
      confidence: i.confidence,
      reason: i.reason,
      fix_suggestion: i.fixSuggestion,
    })))
    .select();
  if (error) throw error;
  return data;
}

// ── Evidence Artifacts ──

export interface CreateEvidenceInput {
  checklistResultId: string;
  source: string;
  nodeId?: string;
  selector?: string;
  screenshotUrl?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  observed: string;
  expected: string;
}

export async function createEvidenceArtifacts(inputs: CreateEvidenceInput[]) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("evidence_artifacts")
    .insert(inputs.map(i => ({
      checklist_result_id: i.checklistResultId,
      source: i.source,
      node_id: i.nodeId,
      selector: i.selector,
      screenshot_url: i.screenshotUrl,
      bounding_box: i.boundingBox,
      observed: i.observed,
      expected: i.expected,
    })))
    .select();
  if (error) throw error;
  return data;
}

// ── GitHub Issues ──

export interface CreateGitHubIssueRecordInput {
  checklistResultId: string;
  repo: string;
  issueNumber?: number;
  issueUrl?: string;
  status?: string;
}

export async function createGitHubIssueRecord(input: CreateGitHubIssueRecordInput) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("github_issues")
    .insert({
      checklist_result_id: input.checklistResultId,
      repo: input.repo,
      issue_number: input.issueNumber,
      issue_url: input.issueUrl,
      status: input.status ?? "created",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Agent Runs ──

export interface CreateAgentRunInput {
  projectId: string;
  provider: string;
  agentType: string;
  inputJson?: unknown;
  outputJson?: unknown;
  status: string;
  costUsd?: number;
  latencyMs?: number;
}

export async function createAgentRun(input: CreateAgentRunInput) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      project_id: input.projectId,
      provider: input.provider,
      agent_type: input.agentType,
      input_json: input.inputJson,
      output_json: input.outputJson,
      status: input.status,
      cost_usd: input.costUsd,
      latency_ms: input.latencyMs,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Full Audit with Evidence (composite) ──

export interface FullAuditResult {
  checkId: string;
  status: string;
  score: number;
  severity?: string;
  confidence?: number;
  reason?: string;
  fixSuggestion?: unknown;
  evidence?: CreateEvidenceInput[];
}

export async function persistFullAudit(
  projectId: string,
  source: string,
  overallScore: number,
  results: FullAuditResult[],
  designContextVersionId?: string,
) {
  if (!supabase) throw new Error("Supabase not configured");

  // 1. Create audit run
  const auditRun = await createAuditRun({
    projectId,
    designContextVersionId,
    source,
    overallScore,
    status: "completed",
  });

  // 2. Create checklist results
  const checklistResults = await createChecklistResults(
    results.map(r => ({
      auditRunId: auditRun.id,
      checkId: r.checkId,
      status: r.status,
      score: r.score,
      severity: r.severity,
      confidence: r.confidence,
      reason: r.reason,
      fixSuggestion: r.fixSuggestion,
    }))
  );

  // 3. Create evidence artifacts (batch per result)
  for (const [idx, result] of results.entries()) {
    if (result.evidence && result.evidence.length > 0) {
      await createEvidenceArtifacts(
        result.evidence.map(e => ({
          ...e,
          checklistResultId: checklistResults[idx].id,
        }))
      );
    }
  }

  return { auditRun, checklistResults };
}
