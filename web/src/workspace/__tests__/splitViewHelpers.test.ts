import { describe, expect, it } from "vitest";
import { combineScreens, countWords, extractHeadings, getScreenCompletionSummary, slugify } from "../splitViewHelpers";

describe("splitViewHelpers", () => {
  it("slugifies headings into anchor ids", () => {
    expect(slugify("Design Tokens / Primary CTA")).toBe("design-tokens-primary-cta");
  });

  it("extracts second-level and deeper headings", () => {
    expect(extractHeadings("# Title\n\n## Overview\n### Tokens\nBody")).toEqual(["Overview", "Tokens"]);
  });

  it("combines screens with separators", () => {
    const screens = [
      { name: "Home", markdown: "# Home", components: [], colorTokens: [] },
      { name: "Settings", markdown: "# Settings", components: [], colorTokens: [] },
    ];
    expect(combineScreens(screens as never)).toBe("# Home\n\n---\n\n# Settings");
  });

  it("counts words from markdown content", () => {
    expect(countWords("## Overview\nDesign tokens and layout rules")).toBe(7);
  });

  it("summarizes screen completion data", () => {
    const screen = {
      name: "Dashboard",
      markdown: "# Dashboard\n\n## Overview\n\n## Components",
      components: ["Sidebar", "Table", "Chart"],
      colorTokens: ["Primary", "Surface"],
    };
    expect(getScreenCompletionSummary(screen as never)).toEqual({
      components: 3,
      tokens: 2,
      sections: 2,
    });
  });
});
