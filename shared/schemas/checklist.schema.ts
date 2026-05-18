import { z } from "zod";

export const CheckSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const CheckStatusSchema = z.enum([
  "pass",
  "fail",
  "warn",
  "skip",
  "error",
]);

export const ChecklistCriterionSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  severity: CheckSeveritySchema,
  source: z.enum(["wcag", "material3", "ant-design", "vts", "custom"]),
  tags: z.string().array().default([]),
});

export const CheckResultSchema = z.object({
  checkId: z.string(),
  status: CheckStatusSchema,
  score: z.number().min(0).max(1),
  severity: CheckSeveritySchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  fixSuggestion: z
    .object({
      description: z.string(),
      effort: z.enum(["trivial", "small", "medium", "large"]).optional(),
      impact: z.enum(["low", "medium", "high", "critical"]).optional(),
    })
    .optional(),
});

export type CheckSeverity = z.infer<typeof CheckSeveritySchema>;
export type CheckStatus = z.infer<typeof CheckStatusSchema>;
export type ChecklistCriterion = z.infer<typeof ChecklistCriterionSchema>;
export type CheckResult = z.infer<typeof CheckResultSchema>;
