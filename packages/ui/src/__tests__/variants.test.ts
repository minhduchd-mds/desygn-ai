/**
 * variants — pure className builder tests.
 *
 * Runs in node env (no rendering). Validates the class strings the
 * primitives apply, plus the severity→tone mapping reused by the dashboard.
 */

import { describe, it, expect } from "vitest";
import {
  buttonClass,
  inputClass,
  cardClass,
  badgeClass,
  spinnerClass,
  checkboxClass,
  switchClass,
  avatarClass,
  initials,
  severityToTone,
} from "../primitives/variants.js";

describe("buttonClass", () => {
  it("defaults to primary md", () => {
    expect(buttonClass()).toBe("dsg-btn dsg-btn--primary dsg-btn--md");
  });

  it("applies variant and size", () => {
    expect(buttonClass("danger", "lg")).toBe("dsg-btn dsg-btn--danger dsg-btn--lg");
  });

  it("appends extra classes", () => {
    expect(buttonClass("ghost", "sm", "w-full")).toBe("dsg-btn dsg-btn--ghost dsg-btn--sm w-full");
  });

  it("omits falsy extra", () => {
    expect(buttonClass("primary", "md", undefined)).toBe("dsg-btn dsg-btn--primary dsg-btn--md");
  });
});

describe("inputClass", () => {
  it("defaults to base class only", () => {
    expect(inputClass()).toBe("dsg-input");
  });

  it("adds error modifier", () => {
    expect(inputClass("error")).toBe("dsg-input dsg-input--error");
  });
});

describe("cardClass", () => {
  it("defaults to default variant", () => {
    expect(cardClass()).toBe("dsg-card dsg-card--default");
  });

  it("applies elevated", () => {
    expect(cardClass("elevated")).toBe("dsg-card dsg-card--elevated");
  });
});

describe("badgeClass", () => {
  it("defaults to neutral", () => {
    expect(badgeClass()).toBe("dsg-badge dsg-badge--neutral");
  });

  it("applies tone", () => {
    expect(badgeClass("success")).toBe("dsg-badge dsg-badge--success");
  });
});

describe("spinnerClass", () => {
  it("defaults to md", () => {
    expect(spinnerClass()).toBe("dsg-spinner dsg-spinner--md");
  });
});

describe("checkboxClass", () => {
  it("returns base class", () => {
    expect(checkboxClass()).toBe("dsg-checkbox");
  });
  it("appends extra", () => {
    expect(checkboxClass("mt-2")).toBe("dsg-checkbox mt-2");
  });
});

describe("switchClass", () => {
  it("is off by default", () => {
    expect(switchClass()).toBe("dsg-switch");
  });
  it("adds --on modifier when checked", () => {
    expect(switchClass(true)).toBe("dsg-switch dsg-switch--on");
  });
});

describe("avatarClass", () => {
  it("defaults to md", () => {
    expect(avatarClass()).toBe("dsg-avatar dsg-avatar--md");
  });
  it("applies size", () => {
    expect(avatarClass("lg")).toBe("dsg-avatar dsg-avatar--lg");
  });
});

describe("initials", () => {
  it("takes first + last initial for multi-word names", () => {
    expect(initials("Minh Duc")).toBe("MD");
    expect(initials("Ada Lovelace Byron")).toBe("AB");
  });
  it("takes first two letters of a single word", () => {
    expect(initials("Sarah")).toBe("SA");
  });
  it("handles extra whitespace", () => {
    expect(initials("  Alex   Kim  ")).toBe("AK");
  });
  it("falls back to ? for empty input", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("severityToTone", () => {
  it("maps each severity to a badge tone", () => {
    expect(severityToTone("critical")).toBe("error");
    expect(severityToTone("serious")).toBe("warning");
    expect(severityToTone("moderate")).toBe("info");
    expect(severityToTone("minor")).toBe("neutral");
  });
});
