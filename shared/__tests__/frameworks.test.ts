/**
 * Multi-framework configuration tests.
 *
 * Verifies framework registry, default configs, and utilities.
 */

import { describe, it, expect } from "vitest";
import {
  FRAMEWORKS,
  getDefaultConfig,
  getFrameworkList,
  supportsStyle,
} from "../frameworks";
import type { FrameworkId, StylingApproach } from "../frameworks";

describe("frameworks", () => {
  describe("FRAMEWORKS registry", () => {
    it("contains all expected frameworks", () => {
      const ids: FrameworkId[] = [
        "react", "vue", "svelte", "webcomponents",
        "flutter", "react-native", "angular", "solid",
      ];
      for (const id of ids) {
        expect(FRAMEWORKS[id]).toBeDefined();
        expect(FRAMEWORKS[id].id).toBe(id);
        expect(FRAMEWORKS[id].name).toBeTruthy();
      }
    });

    it("each framework has valid file extensions", () => {
      for (const fw of Object.values(FRAMEWORKS)) {
        expect(fw.fileExtension).toMatch(/^\./);
        expect(fw.styleExtension).toMatch(/^\./);
      }
    });

    it("each framework has at least one styling approach", () => {
      for (const fw of Object.values(FRAMEWORKS)) {
        expect(fw.styling.length).toBeGreaterThan(0);
      }
    });

    it("each framework has at least one state management option", () => {
      for (const fw of Object.values(FRAMEWORKS)) {
        expect(fw.stateManagement.length).toBeGreaterThan(0);
      }
    });

    it("each framework has features", () => {
      for (const fw of Object.values(FRAMEWORKS)) {
        expect(fw.features.length).toBeGreaterThan(0);
        for (const feature of fw.features) {
          expect(feature.id).toBeTruthy();
          expect(feature.name).toBeTruthy();
          expect(feature.description).toBeTruthy();
          expect(typeof feature.default).toBe("boolean");
        }
      }
    });

    it("React supports css-modules and tailwind", () => {
      expect(FRAMEWORKS.react.styling).toContain("css-modules");
      expect(FRAMEWORKS.react.styling).toContain("tailwind");
    });

    it("Vue supports composition API", () => {
      expect(FRAMEWORKS.vue.stateManagement).toContain("composition");
    });

    it("Svelte 5 has runes feature", () => {
      const runes = FRAMEWORKS.svelte.features.find(f => f.id === "runes");
      expect(runes).toBeDefined();
      expect(runes!.default).toBe(true);
    });

    it("Flutter uses Dart type system", () => {
      expect(FRAMEWORKS.flutter.typeSystem).toBe("dart");
    });

    it("Angular supports signals", () => {
      expect(FRAMEWORKS.angular.stateManagement).toContain("signals");
    });
  });

  describe("getDefaultConfig", () => {
    it("returns valid config for React", () => {
      const config = getDefaultConfig("react");
      expect(config.framework).toBe("react");
      expect(config.styling).toBe("css-modules");
      expect(config.stateManagement).toBe("hooks");
      expect(config.features.length).toBeGreaterThan(0);
      expect(config.naming.component).toBe("PascalCase");
    });

    it("returns valid config for Vue", () => {
      const config = getDefaultConfig("vue");
      expect(config.framework).toBe("vue");
      expect(config.stateManagement).toBe("composition");
      expect(config.features).toContain("scriptSetup");
    });

    it("returns valid config for Svelte", () => {
      const config = getDefaultConfig("svelte");
      expect(config.framework).toBe("svelte");
      expect(config.stateManagement).toBe("stores");
      expect(config.features).toContain("runes");
    });

    it("returns valid config for Flutter", () => {
      const config = getDefaultConfig("flutter");
      expect(config.framework).toBe("flutter");
      expect(config.styling).toBe("inline");
    });

    it("includes output config", () => {
      const config = getDefaultConfig("react");
      expect(config.output.barrel).toBe(true);
      expect(config.output.structure).toBe("grouped");
      expect(config.output.basePath).toBe("src/components");
    });

    it("only includes default-true features", () => {
      const config = getDefaultConfig("react");
      const memoFeature = FRAMEWORKS.react.features.find(f => f.id === "memo");
      expect(memoFeature!.default).toBe(false);
      expect(config.features).not.toContain("memo");

      const forwardRefFeature = FRAMEWORKS.react.features.find(f => f.id === "forwardRef");
      expect(forwardRefFeature!.default).toBe(true);
      expect(config.features).toContain("forwardRef");
    });
  });

  describe("getFrameworkList", () => {
    it("returns all frameworks with display info", () => {
      const list = getFrameworkList();
      expect(list.length).toBe(8);

      for (const item of list) {
        expect(item.id).toBeTruthy();
        expect(item.name).toBeTruthy();
        expect(item.extensions).toContain(".");
      }
    });

    it("includes React with correct extensions", () => {
      const list = getFrameworkList();
      const react = list.find(f => f.id === "react");
      expect(react).toBeDefined();
      expect(react!.extensions).toContain(".tsx");
      expect(react!.extensions).toContain(".module.scss");
    });
  });

  describe("supportsStyle", () => {
    it("React supports css-modules", () => {
      expect(supportsStyle("react", "css-modules")).toBe(true);
    });

    it("React supports tailwind", () => {
      expect(supportsStyle("react", "tailwind")).toBe(true);
    });

    it("Flutter only supports inline", () => {
      expect(supportsStyle("flutter", "inline")).toBe(true);
      expect(supportsStyle("flutter", "tailwind")).toBe(false);
      expect(supportsStyle("flutter", "css-modules")).toBe(false);
    });

    it("Vue supports scss", () => {
      expect(supportsStyle("vue", "scss")).toBe(true);
    });

    it("returns false for unsupported style", () => {
      expect(supportsStyle("webcomponents", "styled-components" as StylingApproach)).toBe(false);
    });
  });
});
