/**
 * Unit tests for the audit feature's PURE helpers (node env, no DOM/React).
 *
 *   - parseFileKeyFromUrl: extracts fileKey/nodeId, returns null on non-Figma.
 *   - scoreBand: maps a 0-100 score to a colour band.
 */

import { describe, it, expect } from "vitest";
import { parseFileKeyFromUrl } from "../useAudits.js";
import { scoreBand } from "../AuditScoreGauge.js";

describe("parseFileKeyFromUrl", () => {
  it("parses a /file/ URL", () => {
    const parsed = parseFileKeyFromUrl("https://www.figma.com/file/abc123/My-Design");
    expect(parsed).toEqual({ fileKey: "abc123" });
  });

  it("parses a /design/ URL", () => {
    const parsed = parseFileKeyFromUrl("https://www.figma.com/design/xyz789/Dashboard");
    expect(parsed?.fileKey).toBe("xyz789");
  });

  it("extracts node-id and converts dash to colon", () => {
    const parsed = parseFileKeyFromUrl(
      "https://www.figma.com/file/abc123/X?node-id=12-345",
    );
    expect(parsed).toEqual({ fileKey: "abc123", nodeId: "12:345" });
  });

  it("returns null for a non-Figma URL", () => {
    expect(parseFileKeyFromUrl("https://example.com/foo")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseFileKeyFromUrl("not a url")).toBeNull();
  });
});

describe("scoreBand", () => {
  it("returns good at or above 90", () => {
    expect(scoreBand(90)).toBe("good");
    expect(scoreBand(100)).toBe("good");
  });

  it("returns warn between 70 and 89", () => {
    expect(scoreBand(70)).toBe("warn");
    expect(scoreBand(89)).toBe("warn");
  });

  it("returns bad below 70", () => {
    expect(scoreBand(69)).toBe("bad");
    expect(scoreBand(0)).toBe("bad");
  });
});
