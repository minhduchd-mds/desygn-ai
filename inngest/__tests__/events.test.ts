/**
 * validateAuditStartPayload — table-driven validation tests.
 *
 * Pure helper, no IO. Verifies that well-formed payloads round-trip
 * unchanged and that each required field produces a descriptive error
 * when missing or wrong-typed.
 */

import { describe, expect, it } from "vitest";
import { validateAuditStartPayload } from "../events.js";

function validPayload() {
  return {
    auditRunId: "run-1",
    userId: "user-1",
    tier: "pro",
    source: "figma",
    figma: {
      fileKey: "FILEKEY",
      nodeId: "1:2",
      accessToken: "figd_xyz",
    },
    options: {
      wcagVersion: "2.2",
      wcagLevel: "AA",
    },
  };
}

describe("validateAuditStartPayload — valid", () => {
  it("accepts a fully populated payload", () => {
    const result = validateAuditStartPayload(validPayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.auditRunId).toBe("run-1");
      expect(result.value.figma.fileKey).toBe("FILEKEY");
      expect(result.value.options.wcagVersion).toBe("2.2");
    }
  });

  it("accepts a payload without optional nodeId / options fields", () => {
    const payload = validPayload();
    delete (payload.figma as { nodeId?: string }).nodeId;
    payload.options = {} as typeof payload.options;
    const result = validateAuditStartPayload(payload);
    expect(result.ok).toBe(true);
  });

  it("accepts every tier value", () => {
    for (const tier of ["free", "pro", "team", "enterprise"] as const) {
      const result = validateAuditStartPayload({ ...validPayload(), tier });
      expect(result.ok).toBe(true);
    }
  });
});

describe("validateAuditStartPayload — invalid", () => {
  const cases: Array<{ label: string; mutate: (p: ReturnType<typeof validPayload>) => unknown; expect: RegExp }> = [
    {
      label: "missing auditRunId",
      mutate: (p) => {
        const { auditRunId: _unused, ...rest } = p;
        return rest;
      },
      expect: /auditRunId/,
    },
    {
      label: "missing userId",
      mutate: (p) => {
        const { userId: _unused, ...rest } = p;
        return rest;
      },
      expect: /userId/,
    },
    {
      label: "missing figma",
      mutate: (p) => {
        const { figma: _unused, ...rest } = p;
        return rest;
      },
      expect: /figma/,
    },
    {
      label: "missing figma.fileKey",
      mutate: (p) => ({ ...p, figma: { ...p.figma, fileKey: "" } }),
      expect: /fileKey/,
    },
    {
      label: "missing figma.accessToken",
      mutate: (p) => ({ ...p, figma: { ...p.figma, accessToken: "" } }),
      expect: /accessToken/,
    },
    {
      label: "wrong tier",
      mutate: (p) => ({ ...p, tier: "platinum" }),
      expect: /tier/,
    },
    {
      label: "wrong source",
      mutate: (p) => ({ ...p, source: "uploaded-json" }),
      expect: /source/,
    },
    {
      label: "wrong wcagLevel",
      mutate: (p) => ({ ...p, options: { wcagLevel: "AAAA" } }),
      expect: /wcagLevel/,
    },
    {
      label: "wrong type on userId",
      mutate: (p) => ({ ...p, userId: 123 }),
      expect: /userId/,
    },
  ];

  for (const c of cases) {
    it(`rejects when ${c.label} — error contains descriptive path`, () => {
      const result = validateAuditStartPayload(c.mutate(validPayload()));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(c.expect);
    });
  }

  it("rejects non-object input", () => {
    expect(validateAuditStartPayload(null).ok).toBe(false);
    expect(validateAuditStartPayload(undefined).ok).toBe(false);
    expect(validateAuditStartPayload("string").ok).toBe(false);
    expect(validateAuditStartPayload(42).ok).toBe(false);
  });
});
