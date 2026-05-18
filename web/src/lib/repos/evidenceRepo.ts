/**
 * evidenceRepo.ts — EvidenceRepository
 *
 * Domain repository for evidence_artifacts and agent_runs tables.
 */

import { BaseRepository } from "./base";

// ── Input / output types ──────────────────────────────────────────────────────

export interface CreateEvidenceArtifactInput {
  checklistResultId: string;
  source: string;
  nodeId?: string;
  selector?: string;
  screenshotUrl?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  observed: string;
  expected: string;
}

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

export interface EvidenceArtifactRow {
  id: string;
  checklist_result_id: string;
  source: string;
  node_id: string | null;
  selector: string | null;
  screenshot_url: string | null;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
  observed: string;
  expected: string;
  created_at: string;
}

export interface AgentRunRow {
  id: string;
  project_id: string;
  provider: string;
  agent_type: string;
  input_json: unknown | null;
  output_json: unknown | null;
  status: string;
  cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class EvidenceRepository extends BaseRepository {
  /** Batch-insert evidence_artifacts. */
  async createArtifacts(inputs: CreateEvidenceArtifactInput[]): Promise<EvidenceArtifactRow[]> {
    return this.createMany<EvidenceArtifactRow>(
      "evidence_artifacts",
      inputs.map(i => ({
        checklist_result_id: i.checklistResultId,
        source: i.source,
        node_id: i.nodeId ?? null,
        selector: i.selector ?? null,
        screenshot_url: i.screenshotUrl ?? null,
        bounding_box: i.boundingBox ?? null,
        observed: i.observed,
        expected: i.expected,
      })),
    );
  }

  /** List all evidence artifacts linked to a given checklist_result_id. */
  async getArtifactsForResult(checklistResultId: string): Promise<EvidenceArtifactRow[]> {
    return this.findMany<EvidenceArtifactRow>(
      "evidence_artifacts",
      "checklist_result_id",
      checklistResultId,
    );
  }

  /** Insert an agent_runs record. */
  async createAgentRun(input: CreateAgentRunInput): Promise<AgentRunRow> {
    return this.create<AgentRunRow>("agent_runs", {
      project_id: input.projectId,
      provider: input.provider,
      agent_type: input.agentType,
      input_json: input.inputJson ?? null,
      output_json: input.outputJson ?? null,
      status: input.status,
      cost_usd: input.costUsd ?? null,
      latency_ms: input.latencyMs ?? null,
    });
  }

  /** List all agent runs for a project, newest first. */
  async getAgentRuns(projectId: string): Promise<AgentRunRow[]> {
    return this.findMany<AgentRunRow>("agent_runs", "project_id", projectId);
  }
}
