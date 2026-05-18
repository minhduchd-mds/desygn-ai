import { z } from "zod";
import { CheckResultSchema } from "./checklist.schema";
import { DesignSourceSchema } from "./designContext.schema";

export const EvidenceArtifactSchema = z.object({
  source: z.enum([
    "figma-node",
    "playwright-screenshot",
    "manual",
    "ai-vision",
  ]),
  nodeId: z.string().optional(),
  selector: z.string().optional(),
  screenshotUrl: z.string().url().optional(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  observed: z.string(),
  expected: z.string(),
});

export const AuditRunSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  designContextVersionId: z.string().uuid().optional(),
  source: DesignSourceSchema,
  overallScore: z.number().int().min(0).max(100),
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  results: CheckResultSchema.array(),
  evidence: z.record(z.string(), EvidenceArtifactSchema.array()), // keyed by checkId
  createdAt: z.string().datetime(),
});

export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;
export type AuditRun = z.infer<typeof AuditRunSchema>;
