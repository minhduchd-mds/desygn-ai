/**
 * Marketplace service tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MarketplaceService, STARTER_TEMPLATES } from "../marketplace";
import type { TemplateBundle } from "../marketplace";

describe("MarketplaceService", () => {
  let service: MarketplaceService;

  beforeEach(() => {
    service = new MarketplaceService();
    service.loadTemplates(STARTER_TEMPLATES);
  });

  describe("search", () => {
    it("returns all templates with no filters", () => {
      const result = service.search({});
      expect(result.templates.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("filters by text query", () => {
      const result = service.search({ text: "SaaS" });
      expect(result.templates.length).toBe(1);
      expect(result.templates[0].name).toContain("SaaS");
    });

    it("filters by category", () => {
      const result = service.search({ category: "e-commerce" });
      expect(result.templates.length).toBe(1);
      expect(result.templates[0].category).toBe("e-commerce");
    });

    it("filters by framework", () => {
      const result = service.search({ framework: "flutter" });
      expect(result.templates.length).toBe(1);
      expect(result.templates[0].frameworks).toContain("flutter");
    });

    it("filters by pricing", () => {
      const result = service.search({ pricing: "free" });
      expect(result.templates.length).toBe(3); // All starters are free
    });

    it("sorts by downloads", () => {
      const result = service.search({ sortBy: "downloads" });
      for (let i = 1; i < result.templates.length; i++) {
        expect(result.templates[i - 1].stats.downloads)
          .toBeGreaterThanOrEqual(result.templates[i].stats.downloads);
      }
    });

    it("sorts by rating", () => {
      const result = service.search({ sortBy: "rating" });
      for (let i = 1; i < result.templates.length; i++) {
        expect(result.templates[i - 1].stats.rating)
          .toBeGreaterThanOrEqual(result.templates[i].stats.rating);
      }
    });

    it("paginates results", () => {
      const result = service.search({ limit: 2, page: 1 });
      expect(result.templates.length).toBe(2);
      expect(result.totalPages).toBe(2);

      const page2 = service.search({ limit: 2, page: 2 });
      expect(page2.templates.length).toBe(1);
    });

    it("returns facets", () => {
      const result = service.search({});
      expect(result.facets.categories.length).toBeGreaterThan(0);
      expect(result.facets.frameworks.length).toBeGreaterThan(0);
      expect(result.facets.pricing.length).toBeGreaterThan(0);
    });

    it("handles no results gracefully", () => {
      const result = service.search({ text: "nonexistent-xyz" });
      expect(result.templates.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getFeatured", () => {
    it("returns high-rated templates", () => {
      const featured = service.getFeatured();
      for (const t of featured) {
        expect(t.stats.rating).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe("getByCategory", () => {
    it("returns templates for a category", () => {
      const results = service.getByCategory("saas-dashboard");
      expect(results.length).toBe(1);
      expect(results[0].category).toBe("saas-dashboard");
    });
  });

  describe("installation", () => {
    it("installs a template", () => {
      const template = STARTER_TEMPLATES[0];
      const config = { framework: "react" as const, styling: "css-modules" as const, stateManagement: "hooks" as const, features: [], naming: { component: "PascalCase" as const, file: "PascalCase" as const, css: "camelCase" as const, props: "camelCase" as const }, output: { barrel: true, docs: false, structure: "grouped" as const, basePath: "src" } };

      const installed = service.install(template, config);
      expect(installed.templateId).toBe(template.id);
      expect(installed.version).toBe(template.version);
      expect(service.isInstalled(template.id)).toBe(true);
    });

    it("uninstalls a template", () => {
      const template = STARTER_TEMPLATES[0];
      const config = { framework: "react" as const, styling: "css-modules" as const, stateManagement: "hooks" as const, features: [], naming: { component: "PascalCase" as const, file: "PascalCase" as const, css: "camelCase" as const, props: "camelCase" as const }, output: { barrel: true, docs: false, structure: "grouped" as const, basePath: "src" } };

      service.install(template, config);
      expect(service.uninstall(template.id)).toBe(true);
      expect(service.isInstalled(template.id)).toBe(false);
    });

    it("lists installed templates", () => {
      const config = { framework: "react" as const, styling: "css-modules" as const, stateManagement: "hooks" as const, features: [], naming: { component: "PascalCase" as const, file: "PascalCase" as const, css: "camelCase" as const, props: "camelCase" as const }, output: { barrel: true, docs: false, structure: "grouped" as const, basePath: "src" } };

      service.install(STARTER_TEMPLATES[0], config);
      service.install(STARTER_TEMPLATES[1], config);
      expect(service.getInstalled().length).toBe(2);
    });
  });

  describe("publishing validation", () => {
    it("validates complete bundle", () => {
      const bundle: TemplateBundle = {
        template: STARTER_TEMPLATES[0],
        designMd: "# Button\n" + "x".repeat(100),
        config: { framework: "react", styling: "css-modules", stateManagement: "hooks", features: [], naming: { component: "PascalCase", file: "PascalCase", css: "camelCase", props: "camelCase" }, output: { barrel: true, docs: false, structure: "grouped", basePath: "src" } },
        files: [],
      };

      const errors = service.validateBundle(bundle);
      expect(errors.length).toBe(0);
    });

    it("rejects bundle with missing name", () => {
      const bundle: TemplateBundle = {
        template: { ...STARTER_TEMPLATES[0], name: "" },
        designMd: "x".repeat(100),
        config: {} as never,
        files: [],
      };

      const errors = service.validateBundle(bundle);
      expect(errors).toContain("Template name is required");
    });

    it("rejects bundle with short description", () => {
      const bundle: TemplateBundle = {
        template: { ...STARTER_TEMPLATES[0], description: "Short" },
        designMd: "x".repeat(100),
        config: {} as never,
        files: [],
      };

      const errors = service.validateBundle(bundle);
      expect(errors).toContain("Description must be at least 20 characters");
    });

    it("rejects invalid semver", () => {
      const bundle: TemplateBundle = {
        template: { ...STARTER_TEMPLATES[0], version: "abc" },
        designMd: "x".repeat(100),
        config: {} as never,
        files: [],
      };

      const errors = service.validateBundle(bundle);
      expect(errors).toContain("Version must be semver (e.g. 1.0.0)");
    });
  });

  describe("cache management", () => {
    it("reports cache size", () => {
      expect(service.cacheSize).toBe(3);
    });

    it("clears cache", () => {
      service.clearCache();
      expect(service.cacheSize).toBe(0);
    });
  });
});
