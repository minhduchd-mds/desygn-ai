/**
 * projectRepo.ts — ProjectRepository
 *
 * Domain repository for design_context_versions table.
 */

import { BaseRepository } from "./base";
import type { DesignSource } from "../../../../shared/schemas/designContext.schema";

// ── Input / output types ──────────────────────────────────────────────────────

export interface CreateDesignContextInput {
  projectId: string;
  source: DesignSource;
  sourceRef?: string;
  versionNumber: number;
  contextJson: unknown;
  checksum?: string;
}

export interface DesignContextVersionRow {
  id: string;
  project_id: string;
  source: DesignSource;
  source_ref: string | null;
  version_number: number;
  context_json: unknown;
  checksum: string | null;
  created_at: string;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class ProjectRepository extends BaseRepository {
  /** Insert a new design_context_versions record. */
  async createDesignContext(input: CreateDesignContextInput): Promise<DesignContextVersionRow> {
    return this.create<DesignContextVersionRow>("design_context_versions", {
      project_id: input.projectId,
      source: input.source,
      source_ref: input.sourceRef ?? null,
      version_number: input.versionNumber,
      context_json: input.contextJson,
      checksum: input.checksum ?? null,
    });
  }

  /** List all design context versions for a project, newest first. */
  async getDesignContexts(projectId: string): Promise<DesignContextVersionRow[]> {
    return this.findMany<DesignContextVersionRow>(
      "design_context_versions",
      "project_id",
      projectId,
    );
  }

  /**
   * Return the single most-recently-created design context version for a
   * project, or null when none exists yet.
   */
  async getLatestDesignContext(projectId: string): Promise<DesignContextVersionRow | null> {
    const { data, error } = await this.getClient()
      .from("design_context_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<DesignContextVersionRow>();
    if (error) throw error;
    return data;
  }
}
