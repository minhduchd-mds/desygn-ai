/**
 * design-engine/ — Design.md generation & analysis orchestration.
 *
 * Consolidates all design-related logic:
 *   • Template registry & loading
 *   • Design.md generation pipeline
 *   • Context building from multiple sources
 *   • Screen generation
 *   • Layout validation
 *   • Image analysis
 *   • v3: Evidence-based design improvements
 *
 * Architecture:
 *   Sources (Figma, files, screenshots) → Context → Template → Design.md → Validation
 */

import type { DesignContext, ValidationReport } from "../../../shared/designContext";
import { createEmptyContext } from "../../../shared/designContext";
import { buildContext, parseFileSources } from "../design/contextBuilder";
import { buildDesignMd, buildPreviewText, inferProjectName, parseDesignMd } from "../design/designParser";
import { computeValidationReport } from "../design/layoutValidator";
import { generateScreens, type Screen } from "../design/screenGenerator";
import { matchTemplates } from "../design/templateMatcher";
import { DESIGN_MD_TEMPLATES, hasDesignMdTemplate, loadDesignMdTemplate, type DesignMdTemplateCategory } from "../design/templateRegistry";
import type { ProjectRequest, OpenDesignDefinition, OpenDesignPreset } from "../app/types";

// ── Types ──────────────────────────────────────────────────────

export interface DesignEngineState {
  context: DesignContext | null;
  validationReport: ValidationReport | null;
  screens: Screen[];
  designMd: string | null;
  isProcessing: boolean;
}

export interface GenerateOptions {
  request: ProjectRequest;
  userPlan: string;
  presets: Record<string, OpenDesignDefinition>;
  benchmarks?: string[];
}

// ── Design Engine ──────────────────────────────────────────────

export class DesignEngine {
  private state: DesignEngineState = {
    context: null,
    validationReport: null,
    screens: [],
    designMd: null,
    isProcessing: false,
  };

  /** Generate Design.md from project request */
  generate(options: GenerateOptions): string {
    const { request, userPlan, presets, benchmarks = [] } = options;
    const designMd = buildDesignMd(request, userPlan, presets, benchmarks);
    this.state.designMd = designMd;
    return designMd;
  }

  /** Build context from file sources */
  async buildContextFromFiles(files: File[]): Promise<DesignContext> {
    const sources = await parseFileSources(files);
    const context = buildContext(sources);
    this.state.context = context;
    return context;
  }

  /** Compute validation report */
  validate(designMd: string): ValidationReport {
    const report = computeValidationReport(designMd);
    this.state.validationReport = report;
    return report;
  }

  /** Generate screens from design context */
  async generateScreens(context: DesignContext): Promise<Screen[]> {
    const screens = await generateScreens(context);
    this.state.screens = screens;
    return screens;
  }

  /** Match templates based on project request */
  findTemplates(query: string) {
    return matchTemplates(query);
  }

  /** Load a specific template */
  async loadTemplate(templateId: string): Promise<string | null> {
    if (!hasDesignMdTemplate(templateId)) return null;
    return loadDesignMdTemplate(templateId);
  }

  /** Parse an existing Design.md into structured context */
  parseDesignMd(content: string, preset?: OpenDesignDefinition) {
    return parseDesignMd(content, preset);
  }

  /** Infer project name from content */
  inferName(content: string): string {
    return inferProjectName(content);
  }

  /** Get current state */
  getState(): Readonly<DesignEngineState> {
    return this.state;
  }

  /** Reset state */
  reset(): void {
    this.state = {
      context: null,
      validationReport: null,
      screens: [],
      designMd: null,
      isProcessing: false,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const designEngine = new DesignEngine();

// ── Re-exports ─────────────────────────────────────────────────

export { DESIGN_MD_TEMPLATES, hasDesignMdTemplate, loadDesignMdTemplate } from "../design/templateRegistry";
export type { DesignMdTemplateCategory } from "../design/templateRegistry";
export { buildPreviewText, inferProjectName } from "../design/designParser";
export { createEmptyContext } from "../../../shared/designContext";
export type { Screen } from "../design/screenGenerator";
