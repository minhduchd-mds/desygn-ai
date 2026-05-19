import { describe, it, expect, vi, beforeEach } from "vitest";
import { DependencyAuditAgent } from "../self-improve/DependencyAuditAgent";
import type { AgentContextV6 } from "../BaseAgent";

vi.mock("../WorktreeRunner", () => {
  const mockRun = vi.fn();
  return {
    WorktreeRunner: class MockRunner { run = mockRun; },
    __mockRun: mockRun,
  };
});

const { __mockRun: mockRun } = await import("../WorktreeRunner") as unknown as { __mockRun: ReturnType<typeof vi.fn> };

function makeCtx(): AgentContextV6 {
  return {
    runId: "r1", projectId: "p1", costBudgetUsd: 1,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

const AUDIT_JSON = JSON.stringify({
  vulnerabilities: {
    "lodash": { severity: "high", via: [{ title: "Prototype Pollution" }] },
    "minimist": { severity: "critical", via: [{ title: "CVE-1" }, { title: "CVE-2" }] },
  },
});

const OUTDATED_JSON = JSON.stringify({
  "react": { current: "18.2.0", wanted: "18.3.0", latest: "19.0.0", type: "dependencies" },
  "vitest": { current: "4.0.0", wanted: "4.1.6", latest: "4.1.6", type: "devDependencies" },
});

describe("DependencyAuditAgent", () => {
  beforeEach(() => { mockRun.mockReset(); });

  it("parses vulnerabilities", async () => {
    mockRun
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: AUDIT_JSON, stderr: "", durationMs: 1000, timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: "{}", stderr: "", durationMs: 500, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({}, makeCtx());
    expect(result.output!.vulnerabilities).toHaveLength(2);
    expect(result.output!.bySeverity.high).toBe(1);
    expect(result.output!.bySeverity.critical).toBe(1);
  });

  it("parses outdated packages", async () => {
    mockRun
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: "{}", stderr: "", durationMs: 500, timedOut: false })
      .mockResolvedValueOnce({ exitCode: 0, success: true, stdout: OUTDATED_JSON, stderr: "", durationMs: 500, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({}, makeCtx());
    expect(result.output!.outdated).toHaveLength(2);
  });

  it("skips audit when requested", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: OUTDATED_JSON, stderr: "", durationMs: 500, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({ skipAudit: true }, makeCtx());
    expect(result.output!.vulnerabilities).toHaveLength(0);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("skips outdated when requested", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: AUDIT_JSON, stderr: "", durationMs: 500, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({ skipOutdated: true }, makeCtx());
    expect(result.output!.outdated).toHaveLength(0);
  });

  it("handles malformed JSON", async () => {
    mockRun.mockResolvedValue({ exitCode: 1, success: false, stdout: "not-json{{{", stderr: "", durationMs: 300, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({}, makeCtx());
    expect(result.output!.vulnerabilities).toHaveLength(0);
    expect(result.output!.outdated).toHaveLength(0);
  });

  it("handles empty output", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "{}", stderr: "", durationMs: 200, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({}, makeCtx());
    expect(result.output!.totalVulns).toBe(0);
  });

  it("initializes bySeverity with zeros", async () => {
    mockRun.mockResolvedValue({ exitCode: 0, success: true, stdout: "{}", stderr: "", durationMs: 200, timedOut: false });
    const result = await new DependencyAuditAgent("/repo").execute({}, makeCtx());
    expect(result.output!.bySeverity).toEqual({ info: 0, low: 0, moderate: 0, high: 0, critical: 0 });
  });
});
