import { z } from "zod";

// Source types for design input
export const DesignSourceSchema = z.enum([
  "figma-plugin",
  "figma-link",
  "screenshot",
  "web-url",
  "manual-spec",
]);

// Base fields for a design node (without recursive children)
const designNodeBase = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  // Accessibility
  inferredRole: z.string().optional(),
  contrastRatio: z.number().optional(),
  touchTargetCompliant: z.boolean().optional(),
});

// Recursive design node type
export interface DesignNode extends z.infer<typeof designNodeBase> {
  children?: DesignNode[];
}

// Individual design node (normalized from SerializedNode)
export const DesignNodeSchema: z.ZodType<DesignNode> = designNodeBase.extend({
  children: z.lazy(() => DesignNodeSchema.array()).optional(),
});

// Full design context
export const DesignContextSchema = z.object({
  source: DesignSourceSchema,
  sourceRef: z.string().optional(), // Figma URL, screenshot path, etc.
  projectId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  nodes: DesignNodeSchema.array(),
  metadata: z.object({
    fileName: z.string().optional(),
    pageName: z.string().optional(),
    viewportType: z
      .enum(["mobile", "tablet", "desktop", "unknown"])
      .optional(),
    componentCount: z.number().int().nonnegative(),
    totalNodes: z.number().int().nonnegative(),
  }),
});

export type DesignSource = z.infer<typeof DesignSourceSchema>;
// DesignNode is exported as an interface above (recursive type)
export type DesignContext = z.infer<typeof DesignContextSchema>;
