import { z } from "zod";

export const GitHubLabelSchema = z.enum([
  "bug",
  "accessibility",
  "design-system",
  "ui-ux",
  "auto-generated",
  "checklist-failure",
  "high-priority",
  "low-priority",
]);

export const GitHubIssueInputSchema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/), // owner/repo format
  title: z.string().min(1).max(256),
  body: z.string().min(1),
  labels: GitHubLabelSchema.array().default(["auto-generated"]),
  assignees: z.string().array().optional(),
});

export const GitHubIssueResponseSchema = z.object({
  id: z.number(),
  number: z.number(),
  url: z.string().url(),
  htmlUrl: z.string().url(),
  state: z.enum(["open", "closed"]),
  title: z.string(),
  createdAt: z.string().datetime(),
});

export const GitHubPRInputSchema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  title: z.string().min(1).max(256),
  body: z.string(),
  head: z.string(),
  base: z.string().default("main"),
  draft: z.boolean().default(true),
  labels: z.string().array().optional(),
});

export type GitHubLabel = z.infer<typeof GitHubLabelSchema>;
export type GitHubIssueInput = z.infer<typeof GitHubIssueInputSchema>;
export type GitHubIssueResponse = z.infer<typeof GitHubIssueResponseSchema>;
export type GitHubPRInput = z.infer<typeof GitHubPRInputSchema>;
