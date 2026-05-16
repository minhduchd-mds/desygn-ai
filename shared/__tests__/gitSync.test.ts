/**
 * Git sync configuration tests.
 *
 * Verifies config generation, PR creation, validation, and serialization.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_GIT_SYNC_CONFIG,
  generateDesignPR,
  generateCommitMessage,
  serializeConfig,
  validateConfig,
} from "../gitSync";
import type { DesignChange, PRFile, GitSyncConfig } from "../gitSync";

describe("gitSync", () => {
  describe("DEFAULT_GIT_SYNC_CONFIG", () => {
    it("has valid structure", () => {
      expect(DEFAULT_GIT_SYNC_CONFIG.version).toBe(1);
      expect(DEFAULT_GIT_SYNC_CONFIG.project.framework).toBe("react");
      expect(DEFAULT_GIT_SYNC_CONFIG.project.baseBranch).toBe("main");
      expect(DEFAULT_GIT_SYNC_CONFIG.sync.provider).toBe("github");
      expect(DEFAULT_GIT_SYNC_CONFIG.sync.autoPR).toBe(true);
    });

    it("has CI defaults enabled", () => {
      expect(DEFAULT_GIT_SYNC_CONFIG.ci.lint).toBe(true);
      expect(DEFAULT_GIT_SYNC_CONFIG.ci.typecheck).toBe(true);
      expect(DEFAULT_GIT_SYNC_CONFIG.ci.test).toBe(true);
      expect(DEFAULT_GIT_SYNC_CONFIG.ci.visualRegression).toBe(false);
    });

    it("has token export enabled", () => {
      expect(DEFAULT_GIT_SYNC_CONFIG.export.tokens.enabled).toBe(true);
      expect(DEFAULT_GIT_SYNC_CONFIG.export.tokens.format).toBe("css-variables");
      expect(DEFAULT_GIT_SYNC_CONFIG.export.tokens.prefix).toBe("--dr-");
    });
  });

  describe("generateDesignPR", () => {
    const config: GitSyncConfig = {
      ...DEFAULT_GIT_SYNC_CONFIG,
      project: {
        name: "test-project",
        figmaFileId: "abc123",
        framework: "react",
        styling: "css-modules",
        baseBranch: "main",
        designBranch: "design/auto-sync",
      },
    };

    const changes: DesignChange[] = [
      {
        type: "component-modified",
        componentPath: "Components/Button",
        componentName: "Button",
        timestamp: Date.now(),
        details: "Updated padding from 8px to 12px",
      },
      {
        type: "token-added",
        componentPath: "Tokens/Colors",
        componentName: "brand-purple",
        timestamp: Date.now(),
        details: "Added new brand color #7c3aed",
      },
    ];

    const files: PRFile[] = [
      { path: "src/components/Button/Button.tsx", content: "export...", action: "update" },
      { path: "src/styles/tokens.css", content: ":root{...}", action: "update" },
    ];

    it("generates PR with correct title", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.title).toContain("2");
      expect(pr.title).toContain("components updated");
    });

    it("generates PR with correct branch info", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.branch).toBe("design/auto-sync");
      expect(pr.baseBranch).toBe("main");
    });

    it("includes labels and reviewers", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.labels).toEqual(["design-sync", "automated"]);
      expect(pr.reviewers).toEqual([]);
    });

    it("generates PR body with change details", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.body).toContain("Button");
      expect(pr.body).toContain("component-modified");
      expect(pr.body).toContain("brand-purple");
      expect(pr.body).toContain("token-added");
    });

    it("generates PR body with file list", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.body).toContain("src/components/Button/Button.tsx");
      expect(pr.body).toContain("src/styles/tokens.css");
      expect(pr.body).toContain("(update)");
    });

    it("includes figma file ID in body", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.body).toContain("abc123");
    });

    it("includes framework in body", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.body).toContain("react");
    });

    it("includes files in PR", () => {
      const pr = generateDesignPR(config, changes, files);
      expect(pr.files).toHaveLength(2);
      expect(pr.files[0].action).toBe("update");
    });
  });

  describe("generateCommitMessage", () => {
    it("generates commit message from template", () => {
      const config = DEFAULT_GIT_SYNC_CONFIG;
      const change: DesignChange = {
        type: "component-modified",
        componentPath: "Components/Card",
        componentName: "Card",
        timestamp: Date.now(),
        details: "Updated shadow",
      };

      const msg = generateCommitMessage(config, change);
      expect(msg).toBe("design: sync Card from Figma");
    });

    it("handles special characters in component name", () => {
      const config = DEFAULT_GIT_SYNC_CONFIG;
      const change: DesignChange = {
        type: "component-added",
        componentPath: "Components/Button/Icon",
        componentName: "Button/Icon",
        timestamp: Date.now(),
        details: "Added",
      };

      const msg = generateCommitMessage(config, change);
      expect(msg).toContain("Button/Icon");
    });
  });

  describe("serializeConfig", () => {
    it("generates valid YAML-like output", () => {
      const config: GitSyncConfig = {
        ...DEFAULT_GIT_SYNC_CONFIG,
        project: {
          name: "my-app",
          figmaFileId: "file123",
          framework: "react",
          styling: "tailwind",
          baseBranch: "main",
          designBranch: "design/sync",
        },
      };

      const yaml = serializeConfig(config);
      expect(yaml).toContain("version: 1");
      expect(yaml).toContain('name: "my-app"');
      expect(yaml).toContain('figmaFileId: "file123"');
      expect(yaml).toContain("framework: react");
      expect(yaml).toContain("styling: tailwind");
      expect(yaml).toContain("autoPR: true");
      expect(yaml).toContain("lint: true");
    });

    it("includes comments header", () => {
      const yaml = serializeConfig(DEFAULT_GIT_SYNC_CONFIG);
      expect(yaml).toContain("# DesignReady.ai Git Sync Configuration");
      expect(yaml).toContain("# Docs:");
    });

    it("includes labels as array", () => {
      const yaml = serializeConfig(DEFAULT_GIT_SYNC_CONFIG);
      expect(yaml).toContain('"design-sync"');
      expect(yaml).toContain('"automated"');
    });
  });

  describe("validateConfig", () => {
    it("returns no errors for valid config", () => {
      const errors = validateConfig({
        project: {
          name: "test",
          figmaFileId: "abc123",
          framework: "react",
          styling: "css-modules",
          baseBranch: "main",
          designBranch: "design/sync",
        },
        sync: {
          provider: "github",
          autoPR: true,
          labels: [],
          reviewers: [],
          commitTemplate: "",
          prTitleTemplate: "",
          prBodyTemplate: "",
          autoMerge: false,
          requireApproval: true,
        },
      });
      expect(errors).toHaveLength(0);
    });

    it("returns errors for missing project name", () => {
      const errors = validateConfig({
        project: {
          name: "",
          figmaFileId: "abc",
          framework: "react",
          styling: "css-modules",
          baseBranch: "main",
          designBranch: "design/sync",
        },
        sync: { provider: "github" } as GitSyncConfig["sync"],
      });
      expect(errors).toContain("project.name is required");
    });

    it("returns errors for missing figma file ID", () => {
      const errors = validateConfig({
        project: {
          name: "test",
          figmaFileId: "",
          framework: "react",
          styling: "css-modules",
          baseBranch: "main",
          designBranch: "design/sync",
        },
        sync: { provider: "github" } as GitSyncConfig["sync"],
      });
      expect(errors).toContain("project.figmaFileId is required");
    });

    it("returns errors for missing sync provider", () => {
      const errors = validateConfig({
        project: {
          name: "test",
          figmaFileId: "abc",
          framework: "react",
          styling: "css-modules",
          baseBranch: "main",
          designBranch: "design/sync",
        },
        sync: {} as GitSyncConfig["sync"],
      });
      expect(errors).toContain("sync.provider is required");
    });

    it("returns multiple errors for empty config", () => {
      const errors = validateConfig({});
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
