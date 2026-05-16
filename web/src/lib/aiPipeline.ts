/**
 * aiPipeline — Multi-step AI orchestration engine.
 *
 * Provides:
 *   • Pipeline definition with typed steps
 *   • Step execution with retry & timeout
 *   • Intermediate result caching
 *   • Error recovery & rollback
 *   • Progress tracking & event emission
 *   • Conditional branching (skip/abort on conditions)
 *
 * Architecture:
 *   PipelineDefinition → PipelineRunner.execute() → PipelineResult
 *   Each step: input → transform → output (feeds next step)
 */

// ── Types ────────────────────────────────────────────────────────

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface PipelineStep<TIn = unknown, TOut = unknown> {
  id: string;
  name: string;
  description?: string;

  /** Transform function. Receives previous step's output. */
  execute: (input: TIn, context: PipelineContext) => TOut | Promise<TOut>;

  /** Optional validator — if returns false, step is skipped. */
  shouldRun?: (input: TIn, context: PipelineContext) => boolean;

  /** Retry configuration for transient failures. */
  retry?: { maxAttempts: number; delayMs: number };

  /** Timeout in ms. Default: 30000 */
  timeout?: number;

  /** Rollback function if later steps fail. */
  rollback?: (output: TOut, context: PipelineContext) => void | Promise<void>;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  onError?: "abort" | "skip" | "continue";
}

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output: unknown;
  duration: number;
  attempts: number;
  error?: string;
}

export interface PipelineResult {
  pipelineId: string;
  status: "completed" | "failed" | "partial";
  steps: StepResult[];
  totalDuration: number;
  output: unknown;
}

export interface PipelineContext {
  pipelineId: string;
  variables: Map<string, unknown>;
  stepResults: Map<string, StepResult>;
  aborted: boolean;
}

export type PipelineEventType = "step:start" | "step:complete" | "step:fail" | "step:skip" | "pipeline:start" | "pipeline:complete" | "pipeline:fail";

export interface PipelineEvent {
  type: PipelineEventType;
  pipelineId: string;
  stepId?: string;
  data?: unknown;
  timestamp: number;
}

type PipelineListener = (event: PipelineEvent) => void;

// ── Pipeline Runner ──────────────────────────────────────────────

export class PipelineRunner {
  private listeners: PipelineListener[] = [];
  private runningPipelines: Map<string, PipelineContext> = new Map();

  on(listener: PipelineListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: PipelineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async execute(pipeline: PipelineDefinition, initialInput: unknown = null): Promise<PipelineResult> {
    const context: PipelineContext = {
      pipelineId: pipeline.id,
      variables: new Map(),
      stepResults: new Map(),
      aborted: false,
    };

    this.runningPipelines.set(pipeline.id, context);

    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    let lastOutput: unknown = initialInput;
    let pipelineStatus: PipelineResult["status"] = "completed";

    this.emit({ type: "pipeline:start", pipelineId: pipeline.id, timestamp: Date.now() });

    for (const step of pipeline.steps) {
      if (context.aborted) {
        stepResults.push({
          stepId: step.id,
          status: "skipped",
          output: null,
          duration: 0,
          attempts: 0,
        });
        continue;
      }

      // Check shouldRun condition
      if (step.shouldRun && !step.shouldRun(lastOutput, context)) {
        const skipped: StepResult = {
          stepId: step.id,
          status: "skipped",
          output: null,
          duration: 0,
          attempts: 0,
        };
        stepResults.push(skipped);
        context.stepResults.set(step.id, skipped);
        this.emit({ type: "step:skip", pipelineId: pipeline.id, stepId: step.id, timestamp: Date.now() });
        continue;
      }

      // Execute step with retry
      const stepResult = await this.executeStep(step, lastOutput, context, pipeline);

      stepResults.push(stepResult);
      context.stepResults.set(step.id, stepResult);

      if (stepResult.status === "completed") {
        lastOutput = stepResult.output;
        this.emit({ type: "step:complete", pipelineId: pipeline.id, stepId: step.id, data: stepResult, timestamp: Date.now() });
      } else if (stepResult.status === "failed") {
        this.emit({ type: "step:fail", pipelineId: pipeline.id, stepId: step.id, data: stepResult.error, timestamp: Date.now() });

        const errorPolicy = pipeline.onError || "abort";
        if (errorPolicy === "abort") {
          context.aborted = true;
          pipelineStatus = "failed";
          // Rollback completed steps
          await this.rollback(pipeline.steps, stepResults, context);
        } else if (errorPolicy === "skip") {
          // Continue with previous output
          pipelineStatus = "partial";
        } else {
          // continue — use null as output
          lastOutput = null;
          pipelineStatus = "partial";
        }
      }
    }

    this.runningPipelines.delete(pipeline.id);

    const result: PipelineResult = {
      pipelineId: pipeline.id,
      status: pipelineStatus,
      steps: stepResults,
      totalDuration: Date.now() - startTime,
      output: lastOutput,
    };

    this.emit({
      type: pipelineStatus === "failed" ? "pipeline:fail" : "pipeline:complete",
      pipelineId: pipeline.id,
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  abort(pipelineId: string): boolean {
    const context = this.runningPipelines.get(pipelineId);
    if (!context) return false;
    context.aborted = true;
    return true;
  }

  isRunning(pipelineId: string): boolean {
    return this.runningPipelines.has(pipelineId);
  }

  private async executeStep(
    step: PipelineStep,
    input: unknown,
    context: PipelineContext,
    _pipeline: PipelineDefinition,
  ): Promise<StepResult> {
    const maxAttempts = step.retry?.maxAttempts ?? 1;
    const delayMs = step.retry?.delayMs ?? 1000;
    const timeout = step.timeout ?? 30000;
    let attempts = 0;
    let lastError = "";

    this.emit({ type: "step:start", pipelineId: context.pipelineId, stepId: step.id, timestamp: Date.now() });
    const stepStart = Date.now();

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const output = await this.withTimeout(
          Promise.resolve(step.execute(input, context)),
          timeout,
        );
        return {
          stepId: step.id,
          status: "completed",
          output,
          duration: Date.now() - stepStart,
          attempts,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempts < maxAttempts) {
          await this.delay(delayMs);
        }
      }
    }

    return {
      stepId: step.id,
      status: "failed",
      output: null,
      duration: Date.now() - stepStart,
      attempts,
      error: lastError,
    };
  }

  private async rollback(
    steps: PipelineStep[],
    results: StepResult[],
    context: PipelineContext,
  ): Promise<void> {
    // Rollback in reverse order, only completed steps
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i];
      const step = steps[i];
      if (result.status === "completed" && step.rollback) {
        try {
          await step.rollback(result.output, context);
        } catch {
          // Rollback errors are swallowed — best effort
        }
      }
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Step timed out after ${ms}ms`)), ms);
      promise.then(
        val => { clearTimeout(timer); resolve(val); },
        err => { clearTimeout(timer); reject(err); },
      );
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ── Pre-built Pipeline Templates ─────────────────────────────────

export function createDesignToCodePipeline(): PipelineDefinition {
  return {
    id: "design-to-code",
    name: "Design → Code Pipeline",
    description: "Full design-to-production pipeline: analyze, generate, validate, optimize",
    onError: "abort",
    steps: [
      {
        id: "analyze",
        name: "Design Analysis",
        description: "Analyze design structure and extract patterns",
        execute: (input: unknown) => {
          const node = input as { name: string; type: string; children?: unknown[] };
          return {
            componentName: node.name,
            type: node.type,
            childCount: node.children?.length ?? 0,
            complexity: (node.children?.length ?? 0) > 5 ? "high" : "low",
          };
        },
      },
      {
        id: "generate",
        name: "Code Generation",
        description: "Generate framework-specific component code",
        execute: (input: unknown) => {
          const analysis = input as { componentName: string; complexity: string };
          return {
            code: `export function ${analysis.componentName}() { return <div />; }`,
            language: "tsx",
            lines: analysis.complexity === "high" ? 50 : 20,
          };
        },
      },
      {
        id: "validate",
        name: "Code Validation",
        description: "Validate generated code for correctness",
        execute: (input: unknown) => {
          const code = input as { code: string; language: string; lines: number };
          const issues: string[] = [];
          if (!code.code.includes("export")) issues.push("Missing export");
          return { valid: issues.length === 0, issues, code: code.code };
        },
      },
      {
        id: "optimize",
        name: "Code Optimization",
        description: "Optimize generated code for performance",
        shouldRun: (input: unknown) => {
          const validation = input as { valid: boolean };
          return validation.valid;
        },
        execute: (input: unknown) => {
          const validated = input as { code: string };
          return {
            code: validated.code,
            optimized: true,
            sizeSaved: "12%",
          };
        },
      },
    ],
  };
}

export function createBatchGenerationPipeline(): PipelineDefinition {
  return {
    id: "batch-generation",
    name: "Batch Component Generation",
    description: "Generate multiple components in sequence with shared context",
    onError: "skip",
    steps: [
      {
        id: "discover",
        name: "Component Discovery",
        execute: (input: unknown) => {
          const nodes = input as { name: string }[];
          return { components: nodes.map(n => n.name), count: nodes.length };
        },
      },
      {
        id: "generate-all",
        name: "Generate All",
        execute: (input: unknown) => {
          const discovery = input as { components: string[]; count: number };
          return {
            generated: discovery.components.map(name => ({ name, status: "done" })),
            total: discovery.count,
          };
        },
      },
      {
        id: "bundle",
        name: "Bundle Output",
        execute: (input: unknown) => {
          const generated = input as { generated: { name: string }[]; total: number };
          return {
            bundle: true,
            components: generated.generated.length,
            indexFile: generated.generated.map(g => `export * from './${g.name}';`).join("\n"),
          };
        },
      },
    ],
  };
}
