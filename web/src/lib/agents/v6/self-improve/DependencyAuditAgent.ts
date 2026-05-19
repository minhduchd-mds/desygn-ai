/**
 * DependencyAuditAgent — checks npm audit + outdated deps.
 *
 * Wraps two CLI commands:
 *   - `npm audit --json` for known CVE
 *   - `npm outdated --json` for upgrade suggestions
 *
 * Output is structured for the Orchestrator to feed into Dependabot or to
 * generate auto-upgrade PRs.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import { WorktreeRunner } from "../WorktreeRunner";

export interface DependencyAuditInput {
  /** Skip the audit step (default false) */
  skipAudit?: boolean;
  /** Skip the outdated step (default false) */
  skipOutdated?: boolean;
}

export interface VulnerabilityInfo {
  name: string;
  severity: "info" | "low" | "moderate" | "high" | "critical";
  count: number;
}

export interface OutdatedInfo {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: "dependencies" | "devDependencies" | "optionalDependencies";
}

export interface DependencyAuditOutput {
  vulnerabilities: VulnerabilityInfo[];
  outdated: OutdatedInfo[];
  totalVulns: number;
  bySeverity: Record<VulnerabilityInfo["severity"], number>;
}

export class DependencyAuditAgent extends BaseAgentV6<
  DependencyAuditInput,
  DependencyAuditOutput
> {
  readonly id = "self-improve.dep-audit";
  readonly name = "Dependency Auditor";
  readonly fleet: FleetName = "self-improve";
  readonly role = "analyzer" as const;
  readonly description = "Runs npm audit + npm outdated and returns structured vulnerability/upgrade data";

  private readonly runner: WorktreeRunner;

  constructor(repoRoot: string) {
    super();
    this.runner = new WorktreeRunner(repoRoot);
  }

  protected async run(
    input: DependencyAuditInput,
    ctx: AgentContextV6,
  ): Promise<{ output: DependencyAuditOutput; evidence?: string[] }> {
    const handle = ctx.worktreePath
      ? { id: "external", path: ctx.worktreePath, branch: "", createdAt: 0 }
      : { id: "main", path: process.cwd(), branch: "main", createdAt: 0 };

    let vulnerabilities: VulnerabilityInfo[] = [];
    let bySeverity: DependencyAuditOutput["bySeverity"] = {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    };

    if (!input.skipAudit) {
      const auditResult = await this.runner.run(handle, "npm", ["audit", "--json"], {
        timeoutMs: 90_000,
        signal: ctx.signal,
      });
      const parsed = safeJsonParse(auditResult.stdout);
      if (parsed && typeof parsed === "object" && "vulnerabilities" in parsed) {
        const vulnsMap = (parsed as { vulnerabilities: Record<string, unknown> }).vulnerabilities;
        for (const [name, info] of Object.entries(vulnsMap ?? {})) {
          if (info && typeof info === "object" && "severity" in info) {
            const sev = (info as { severity: VulnerabilityInfo["severity"] }).severity;
            const via = (info as { via?: unknown[] }).via ?? [];
            vulnerabilities.push({ name, severity: sev, count: via.length });
            if (sev in bySeverity) bySeverity[sev]++;
          }
        }
      }
    }

    let outdated: OutdatedInfo[] = [];
    if (!input.skipOutdated) {
      const outdatedResult = await this.runner.run(handle, "npm", ["outdated", "--json"], {
        timeoutMs: 90_000,
        signal: ctx.signal,
      });
      const parsed = safeJsonParse(outdatedResult.stdout);
      if (parsed && typeof parsed === "object") {
        for (const [name, info] of Object.entries(parsed as Record<string, unknown>)) {
          if (info && typeof info === "object") {
            const i = info as Partial<OutdatedInfo>;
            outdated.push({
              name,
              current: i.current ?? "",
              wanted: i.wanted ?? "",
              latest: i.latest ?? "",
              type: i.type ?? "dependencies",
            });
          }
        }
      }
    }

    const totalVulns = vulnerabilities.reduce((acc, v) => acc + v.count, 0);
    ctx.logger.info(
      `[dep-audit] vulnerabilities=${totalVulns} outdated=${outdated.length}`,
    );

    return {
      output: { vulnerabilities, outdated, totalVulns, bySeverity },
      evidence: [
        `total-vulns=${totalVulns}`,
        `outdated=${outdated.length}`,
        ...Object.entries(bySeverity)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${k}=${n}`),
      ],
    };
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
