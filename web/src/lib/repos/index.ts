/**
 * repos/index.ts — Barrel file for repository classes.
 *
 * Import individual repos or call createRepositories() for a preconfigured
 * object holding one instance of each domain repository.
 */

export { BaseRepository } from "./base";

export { AuditRepository } from "./auditRepo";
export type {
  CreateAuditRunInput,
  UpdateAuditRunInput,
  CreateChecklistResultInput,
  AuditRunRow,
  ChecklistResultRow,
  AuditRunWithResults,
} from "./auditRepo";

export { ProjectRepository } from "./projectRepo";
export type {
  CreateDesignContextInput,
  DesignContextVersionRow,
} from "./projectRepo";

export { GitHubRepository } from "./githubRepo";
export type {
  CreateGitHubIssueInput,
  CreateGitHubPRInput,
  UpdateIssueStatusInput,
  GitHubIssueRow,
  GitHubPRRow,
} from "./githubRepo";

export { EvidenceRepository } from "./evidenceRepo";
export type {
  CreateEvidenceArtifactInput,
  CreateAgentRunInput,
  EvidenceArtifactRow,
  AgentRunRow,
} from "./evidenceRepo";

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns a preconfigured set of repository instances.
 *
 * @example
 * const repos = createRepositories();
 * const run = await repos.audit.createRun({ projectId, source: "figma-plugin" });
 */
export function createRepositories() {
  return {
    audit: new AuditRepository(),
    project: new ProjectRepository(),
    github: new GitHubRepository(),
    evidence: new EvidenceRepository(),
  };
}
