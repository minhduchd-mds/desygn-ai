/**
 * gitSync — Git-first Design System workflow configuration.
 *
 * Competitive Advantage vs Figma:
 *   Figma: Design → Export → Manual copy → Create PR manually
 *   Desygn AI: Design → Auto-sync → Auto-PR → CI passes → Merge
 *
 * Features:
 *   • .desygnrc.yml configuration format
 *   • GitHub/GitLab/Bitbucket integration types
 *   • Auto-PR generation with design diffs
 *   • Design change detection → commit triggers
 *   • CI/CD pipeline integration
 *   • Multi-branch design workflows
 *
 * Usage:
 *   const config = parseGitSyncConfig(yamlContent);
 *   const pr = generateDesignPR(config, designChanges);
 */

import type { FrameworkId, StylingApproach } from "./frameworks";

// ── Configuration Types ───────────────────────────────────────

export interface GitSyncConfig {
  version: 1;
  project: ProjectConfig;
  export: ExportConfig;
  sync: SyncConfig;
  ci: CIConfig;
  notifications: NotificationConfig;
}

export interface ProjectConfig {
  name: string;
  figmaFileId: string;
  framework: FrameworkId;
  styling: StylingApproach;
  baseBranch: string;         // "main" | "develop"
  designBranch: string;       // "design/auto-sync"
}

export interface ExportConfig {
  format: "design-md" | "json" | "both";
  outputs: OutputMapping[];
  templates: TemplateMapping[];
  tokens: TokenExportConfig;
}

export interface OutputMapping {
  /** Figma component path (e.g. "Components/Button") */
  source: string;
  /** Code output path (e.g. "src/components/Button/Button.tsx") */
  target: string;
  /** Override framework for specific components */
  framework?: FrameworkId;
}

export interface TemplateMapping {
  /** Template name (e.g. "saas-dashboard") */
  template: string;
  /** Output directory */
  outputDir: string;
  /** Include patterns */
  include: string[];
  /** Exclude patterns */
  exclude: string[];
}

export interface TokenExportConfig {
  enabled: boolean;
  format: "css-variables" | "scss-variables" | "tailwind-config" | "json" | "all";
  outputPath: string;
  prefix: string;   // e.g. "--dr-" for CSS variables
}

export interface SyncConfig {
  /** Git hosting provider */
  provider: "github" | "gitlab" | "bitbucket";
  /** Auto-create PR on design changes */
  autoPR: boolean;
  /** PR labels to apply */
  labels: string[];
  /** Reviewers to assign */
  reviewers: string[];
  /** Commit message template */
  commitTemplate: string;
  /** PR title template */
  prTitleTemplate: string;
  /** PR body template */
  prBodyTemplate: string;
  /** Auto-merge if CI passes */
  autoMerge: boolean;
  /** Require manual approval before merge */
  requireApproval: boolean;
}

export interface CIConfig {
  /** Run lint on generated code */
  lint: boolean;
  /** Run type check on generated code */
  typecheck: boolean;
  /** Run tests on generated code */
  test: boolean;
  /** Run visual regression tests */
  visualRegression: boolean;
  /** Custom CI commands to run */
  customCommands: string[];
}

export interface NotificationConfig {
  /** Notify on sync completion */
  onSuccess: NotificationChannel[];
  /** Notify on sync failure */
  onFailure: NotificationChannel[];
  /** Notify on PR created */
  onPRCreated: NotificationChannel[];
}

export type NotificationChannel =
  | { type: "slack"; webhookUrl: string; channel: string }
  | { type: "email"; recipients: string[] }
  | { type: "discord"; webhookUrl: string };

// ── Design Change Types ───────────────────────────────────────

export interface DesignChange {
  type: DesignChangeType;
  componentPath: string;
  componentName: string;
  timestamp: number;
  details: string;
  previousHash?: string;
  currentHash?: string;
}

export type DesignChangeType =
  | "component-added"
  | "component-modified"
  | "component-deleted"
  | "token-added"
  | "token-modified"
  | "token-deleted"
  | "variant-added"
  | "variant-modified"
  | "variant-deleted";

export interface DesignPR {
  title: string;
  body: string;
  branch: string;
  baseBranch: string;
  labels: string[];
  reviewers: string[];
  files: PRFile[];
}

export interface PRFile {
  path: string;
  content: string;
  action: "create" | "update" | "delete";
}

// ── PR Template ─────────────────────────────────────────��─────

const DESIGN_PR_BODY_TEMPLATE = `## Design Sync

**Source:** Figma file \`\${figmaFileId}\`
**Components changed:** \${changeCount}
**Framework:** \${framework}

### Changes

\${changeList}

### Generated Files

\${fileList}

### Verification

- [ ] Generated code matches design specs
- [ ] Token values are correct
- [ ] Responsive variants work
- [ ] Accessibility requirements met

---
Synced by [Desygn AI](https://github.com/minhduchd-mds/desygn-ai) | \${timestamp}`;

// ── Default Configuration ─────────────────────────────────────

export const DEFAULT_GIT_SYNC_CONFIG: GitSyncConfig = {
  version: 1,
  project: {
    name: "",
    figmaFileId: "",
    framework: "react",
    styling: "css-modules",
    baseBranch: "main",
    designBranch: "design/auto-sync",
  },
  export: {
    format: "design-md",
    outputs: [],
    templates: [],
    tokens: {
      enabled: true,
      format: "css-variables",
      outputPath: "src/styles/tokens.css",
      prefix: "--dr-",
    },
  },
  sync: {
    provider: "github",
    autoPR: true,
    labels: ["design-sync", "automated"],
    reviewers: [],
    commitTemplate: "design: sync ${componentName} from Figma",
    prTitleTemplate: "Design Sync: ${changeCount} components updated",
    prBodyTemplate: DESIGN_PR_BODY_TEMPLATE,
    autoMerge: false,
    requireApproval: true,
  },
  ci: {
    lint: true,
    typecheck: true,
    test: true,
    visualRegression: false,
    customCommands: [],
  },
  notifications: {
    onSuccess: [],
    onFailure: [],
    onPRCreated: [],
  },
};

// ── Utilities ─────────────────────────────────────────────────

/**
 * Generate a Design PR from changes and config.
 */
export function generateDesignPR(
  config: GitSyncConfig,
  changes: DesignChange[],
  files: PRFile[],
): DesignPR {
  const changeCount = changes.length;
  const changeList = changes
    .map(c => `- **${c.type}**: \`${c.componentName}\` — ${c.details}`)
    .join("\n");
  const fileList = files
    .map(f => `- \`${f.path}\` (${f.action})`)
    .join("\n");

  const title = config.sync.prTitleTemplate
    .replace("${changeCount}", String(changeCount));

  const body = config.sync.prBodyTemplate
    .replace("${figmaFileId}", config.project.figmaFileId)
    .replace("${changeCount}", String(changeCount))
    .replace("${framework}", config.project.framework)
    .replace("${changeList}", changeList)
    .replace("${fileList}", fileList)
    .replace("${timestamp}", new Date().toISOString());

  return {
    title,
    body,
    branch: config.project.designBranch,
    baseBranch: config.project.baseBranch,
    labels: config.sync.labels,
    reviewers: config.sync.reviewers,
    files,
  };
}

/**
 * Generate commit message from a design change.
 */
export function generateCommitMessage(
  config: GitSyncConfig,
  change: DesignChange,
): string {
  return config.sync.commitTemplate
    .replace("${componentName}", change.componentName);
}

/**
 * Serialize config to YAML-like format for .desygnrc.yml
 */
export function serializeConfig(config: GitSyncConfig): string {
  return [
    `# Desygn AI Git Sync Configuration`,
    `# Docs: https://github.com/minhduchd-mds/desygn-ai/blob/main/docs/DEV_GUIDE.md`,
    ``,
    `version: ${config.version}`,
    ``,
    `project:`,
    `  name: "${config.project.name}"`,
    `  figmaFileId: "${config.project.figmaFileId}"`,
    `  framework: ${config.project.framework}`,
    `  styling: ${config.project.styling}`,
    `  baseBranch: ${config.project.baseBranch}`,
    `  designBranch: ${config.project.designBranch}`,
    ``,
    `export:`,
    `  format: ${config.export.format}`,
    `  tokens:`,
    `    enabled: ${config.export.tokens.enabled}`,
    `    format: ${config.export.tokens.format}`,
    `    outputPath: ${config.export.tokens.outputPath}`,
    `    prefix: "${config.export.tokens.prefix}"`,
    ``,
    `sync:`,
    `  provider: ${config.sync.provider}`,
    `  autoPR: ${config.sync.autoPR}`,
    `  labels: [${config.sync.labels.map(l => `"${l}"`).join(", ")}]`,
    `  autoMerge: ${config.sync.autoMerge}`,
    `  requireApproval: ${config.sync.requireApproval}`,
    ``,
    `ci:`,
    `  lint: ${config.ci.lint}`,
    `  typecheck: ${config.ci.typecheck}`,
    `  test: ${config.ci.test}`,
    `  visualRegression: ${config.ci.visualRegression}`,
  ].join("\n");
}

/**
 * Validate a git sync config for required fields.
 */
export function validateConfig(config: Partial<GitSyncConfig>): string[] {
  const errors: string[] = [];

  if (!config.project?.name) errors.push("project.name is required");
  if (!config.project?.figmaFileId) errors.push("project.figmaFileId is required");
  if (!config.project?.framework) errors.push("project.framework is required");
  if (!config.sync?.provider) errors.push("sync.provider is required");

  return errors;
}
