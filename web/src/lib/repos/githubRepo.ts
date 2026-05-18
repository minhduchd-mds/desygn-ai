/**
 * githubRepo.ts — GitHubRepository
 *
 * Domain repository for github_issues and github_pull_requests tables.
 */

import { BaseRepository } from "./base";

// ── Input / output types ──────────────────────────────────────────────────────

export interface CreateGitHubIssueInput {
  checklistResultId: string;
  repo: string;
  issueNumber?: number;
  issueUrl?: string;
  status?: string;
}

export interface CreateGitHubPRInput {
  githubIssueId: string;
  repo: string;
  prNumber?: number;
  prUrl?: string;
  status?: string;
  ciStatus?: string;
}

export interface UpdateIssueStatusInput {
  status: string;
}

export interface GitHubIssueRow {
  id: string;
  checklist_result_id: string;
  repo: string;
  issue_number: number | null;
  issue_url: string | null;
  status: string;
  created_at: string;
}

export interface GitHubPRRow {
  id: string;
  github_issue_id: string;
  repo: string;
  pr_number: number | null;
  pr_url: string | null;
  status: string | null;
  ci_status: string | null;
  created_at: string;
}

// ── Repository ────────────────────────────────────────────────────────────────

export class GitHubRepository extends BaseRepository {
  /** Insert a new github_issues record linked to a checklist result. */
  async createIssue(input: CreateGitHubIssueInput): Promise<GitHubIssueRow> {
    return this.create<GitHubIssueRow>("github_issues", {
      checklist_result_id: input.checklistResultId,
      repo: input.repo,
      issue_number: input.issueNumber ?? null,
      issue_url: input.issueUrl ?? null,
      status: input.status ?? "created",
    });
  }

  /** Insert a new github_pull_requests record linked to a GitHub issue. */
  async createPR(input: CreateGitHubPRInput): Promise<GitHubPRRow> {
    return this.create<GitHubPRRow>("github_pull_requests", {
      github_issue_id: input.githubIssueId,
      repo: input.repo,
      pr_number: input.prNumber ?? null,
      pr_url: input.prUrl ?? null,
      status: input.status ?? null,
      ci_status: input.ciStatus ?? null,
    });
  }

  /** List all GitHub issues linked to a given checklist_result_id. */
  async getIssuesForResult(checklistResultId: string): Promise<GitHubIssueRow[]> {
    return this.findMany<GitHubIssueRow>(
      "github_issues",
      "checklist_result_id",
      checklistResultId,
    );
  }

  /** Update the status field of a github_issues record. */
  async updateIssueStatus(id: string, status: string): Promise<GitHubIssueRow> {
    return this.update<GitHubIssueRow>("github_issues", id, { status });
  }
}
