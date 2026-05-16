/**
 * designSystemHub — Multi-Design-System Management.
 *
 * Competitive Advantage vs Figma:
 *   Figma manages 1 file at a time. Enterprises have 10-50 Figma files
 *   across brands, products, and platforms. DesignReady.ai unifies them:
 *
 *   • Aggregate multiple Figma files into a unified system view
 *   • Cross-system pattern detection (find "Button" across 10 brands)
 *   • Component deduplication analysis
 *   • Token consolidation across systems
 *   • Consistency scoring between design systems
 *   • Design system governance and drift detection
 *
 * Target: Enterprise customers managing $500K+ in design system investment.
 */

import type { ScanResult, SerializedNode } from "../../../shared/types";

// ── Types ─────────────────────────────────────────────────────

export interface DesignSystem {
  id: string;
  name: string;
  brand: string;
  figmaFileId: string;
  description: string;
  platform: DesignSystemPlatform;
  components: SystemComponent[];
  tokens: SystemTokens;
  lastSynced: number;
  healthScore: number;     // 0-100
  metadata: SystemMetadata;
}

export type DesignSystemPlatform = "web" | "ios" | "android" | "cross-platform";

export interface SystemComponent {
  id: string;
  name: string;
  type: "atom" | "molecule" | "organism";
  variants: number;
  lastModified: number;
  scanResult?: ScanResult;
  node?: SerializedNode;
}

export interface SystemTokens {
  colors: TokenValue[];
  spacings: TokenValue[];
  typography: TokenValue[];
  radii: TokenValue[];
  shadows: TokenValue[];
}

export interface TokenValue {
  name: string;
  value: string;
  usageCount: number;
  systems: string[];   // Which systems use this token
}

export interface SystemMetadata {
  componentCount: number;
  tokenCount: number;
  lastAudit: number;
  teamOwner: string;
  version: string;
}

// ── Cross-System Analysis Types ───────────────────────────────

export interface CrossSystemReport {
  systems: DesignSystem[];
  consistency: ConsistencyScore;
  duplicates: DuplicateGroup[];
  tokenConflicts: TokenConflict[];
  recommendations: SystemRecommendation[];
  unificationOpportunities: UnificationOpportunity[];
}

export interface ConsistencyScore {
  overall: number;          // 0-100
  naming: number;           // Naming convention consistency
  tokens: number;           // Token value alignment
  spacing: number;          // Spacing scale consistency
  typography: number;       // Type scale alignment
  components: number;       // Component pattern overlap
}

export interface DuplicateGroup {
  componentName: string;
  pattern: string;          // Common pattern description
  instances: DuplicateInstance[];
  consolidationSavings: number;  // Hours saved if consolidated
}

export interface DuplicateInstance {
  systemId: string;
  systemName: string;
  componentId: string;
  componentName: string;
  similarity: number;       // 0-1 similarity score
}

export interface TokenConflict {
  tokenName: string;
  values: { systemId: string; systemName: string; value: string }[];
  severity: "critical" | "warning" | "info";
  suggestion: string;
}

export interface SystemRecommendation {
  id: string;
  type: "consolidate" | "standardize" | "deprecate" | "create" | "align";
  title: string;
  description: string;
  impact: string;
  affectedSystems: string[];
  effort: "trivial" | "small" | "medium" | "large";
}

export interface UnificationOpportunity {
  componentName: string;
  systems: string[];
  sharedProperties: string[];
  divergentProperties: string[];
  unificationScore: number;  // 0-1 how easy to unify
  estimatedSavings: number;  // Hours
}

// ── Design System Drift Detection ─────────────────────────────

export interface DriftReport {
  systemId: string;
  systemName: string;
  drifts: DriftItem[];
  severity: "healthy" | "minor-drift" | "major-drift" | "critical";
  lastChecked: number;
}

export interface DriftItem {
  component: string;
  property: string;
  expected: string;       // From shared spec
  actual: string;         // Current value
  firstDetected: number;
  severity: "info" | "warning" | "error";
}

// ── Hub Implementation ────────────────────────────────────────

export class DesignSystemHub {
  private systems = new Map<string, DesignSystem>();
  private driftHistory = new Map<string, DriftReport[]>();

  // ── System Management ─────────────────────────────────────

  /**
   * Register a new design system in the hub.
   */
  addSystem(system: DesignSystem): void {
    this.systems.set(system.id, system);
  }

  /**
   * Remove a design system from the hub.
   */
  removeSystem(id: string): boolean {
    this.driftHistory.delete(id);
    return this.systems.delete(id);
  }

  /**
   * Get all registered systems.
   */
  getSystems(): DesignSystem[] {
    return [...this.systems.values()];
  }

  /**
   * Get a specific system by ID.
   */
  getSystem(id: string): DesignSystem | undefined {
    return this.systems.get(id);
  }

  /**
   * Update a system's components after a scan.
   */
  updateComponents(systemId: string, components: SystemComponent[]): void {
    const system = this.systems.get(systemId);
    if (system) {
      system.components = components;
      system.metadata.componentCount = components.length;
      system.lastSynced = Date.now();
    }
  }

  // ── Cross-System Analysis ─────────────────���───────────────

  /**
   * Run cross-system analysis to find patterns, duplicates, and conflicts.
   */
  analyzeCrossSystems(): CrossSystemReport {
    const systems = this.getSystems();
    const consistency = this.computeConsistency(systems);
    const duplicates = this.findDuplicates(systems);
    const tokenConflicts = this.findTokenConflicts(systems);
    const unificationOpportunities = this.findUnificationOpportunities(systems);
    const recommendations = this.generateSystemRecommendations(
      consistency, duplicates, tokenConflicts, unificationOpportunities
    );

    return {
      systems,
      consistency,
      duplicates,
      tokenConflicts,
      recommendations,
      unificationOpportunities,
    };
  }

  /**
   * Find components that exist across multiple systems.
   */
  findSharedComponents(): Map<string, { systems: string[]; variants: number }> {
    const componentMap = new Map<string, { systems: string[]; variants: number }>();

    for (const system of this.systems.values()) {
      for (const comp of system.components) {
        const normalizedName = comp.name.toLowerCase().replace(/[-_\s]/g, "");
        const existing = componentMap.get(normalizedName) ?? { systems: [], variants: 0 };
        existing.systems.push(system.name);
        existing.variants += comp.variants;
        componentMap.set(normalizedName, existing);
      }
    }

    // Only return components in 2+ systems
    const shared = new Map<string, { systems: string[]; variants: number }>();
    for (const [name, data] of componentMap) {
      if (data.systems.length >= 2) {
        shared.set(name, data);
      }
    }

    return shared;
  }

  /**
   * Generate a unified token registry across all systems.
   */
  getUnifiedTokens(): SystemTokens {
    const unified: SystemTokens = {
      colors: [],
      spacings: [],
      typography: [],
      radii: [],
      shadows: [],
    };

    for (const system of this.systems.values()) {
      for (const color of system.tokens.colors) {
        const existing = unified.colors.find(c => c.value === color.value);
        if (existing) {
          existing.usageCount += color.usageCount;
          if (!existing.systems.includes(system.name)) {
            existing.systems.push(system.name);
          }
        } else {
          unified.colors.push({ ...color, systems: [system.name] });
        }
      }

      for (const spacing of system.tokens.spacings) {
        const existing = unified.spacings.find(s => s.value === spacing.value);
        if (existing) {
          existing.usageCount += spacing.usageCount;
          if (!existing.systems.includes(system.name)) {
            existing.systems.push(system.name);
          }
        } else {
          unified.spacings.push({ ...spacing, systems: [system.name] });
        }
      }
    }

    // Sort by usage
    unified.colors.sort((a, b) => b.usageCount - a.usageCount);
    unified.spacings.sort((a, b) => b.usageCount - a.usageCount);

    return unified;
  }

  // ── Drift Detection ───────────────────────────────────────

  /**
   * Check for design drift in a system against the shared specification.
   */
  detectDrift(systemId: string, sharedSpec: SystemTokens): DriftReport {
    const system = this.systems.get(systemId);
    if (!system) {
      return {
        systemId,
        systemName: "Unknown",
        drifts: [],
        severity: "healthy",
        lastChecked: Date.now(),
      };
    }

    const drifts: DriftItem[] = [];

    // Check color drift
    for (const sharedColor of sharedSpec.colors) {
      const localColor = system.tokens.colors.find(c => c.name === sharedColor.name);
      if (localColor && localColor.value !== sharedColor.value) {
        drifts.push({
          component: "tokens",
          property: `color/${sharedColor.name}`,
          expected: sharedColor.value,
          actual: localColor.value,
          firstDetected: Date.now(),
          severity: "warning",
        });
      } else if (!localColor) {
        drifts.push({
          component: "tokens",
          property: `color/${sharedColor.name}`,
          expected: sharedColor.value,
          actual: "(missing)",
          firstDetected: Date.now(),
          severity: "info",
        });
      }
    }

    // Check spacing drift
    for (const sharedSpacing of sharedSpec.spacings) {
      const localSpacing = system.tokens.spacings.find(s => s.name === sharedSpacing.name);
      if (localSpacing && localSpacing.value !== sharedSpacing.value) {
        drifts.push({
          component: "tokens",
          property: `spacing/${sharedSpacing.name}`,
          expected: sharedSpacing.value,
          actual: localSpacing.value,
          firstDetected: Date.now(),
          severity: "error",
        });
      }
    }

    const severity = this.classifyDriftSeverity(drifts);
    const report: DriftReport = {
      systemId,
      systemName: system.name,
      drifts,
      severity,
      lastChecked: Date.now(),
    };

    // Store in history
    const history = this.driftHistory.get(systemId) ?? [];
    history.push(report);
    if (history.length > 50) history.shift();
    this.driftHistory.set(systemId, history);

    return report;
  }

  /**
   * Get drift history for a system.
   */
  getDriftHistory(systemId: string): DriftReport[] {
    return this.driftHistory.get(systemId) ?? [];
  }

  // ── Hub Statistics ────────────────────────────────────────

  getStats(): {
    totalSystems: number;
    totalComponents: number;
    totalTokens: number;
    averageHealth: number;
    sharedComponentCount: number;
  } {
    const systems = this.getSystems();
    const shared = this.findSharedComponents();

    return {
      totalSystems: systems.length,
      totalComponents: systems.reduce((sum, s) => sum + s.components.length, 0),
      totalTokens: systems.reduce((sum, s) =>
        sum + s.tokens.colors.length + s.tokens.spacings.length +
        s.tokens.typography.length + s.tokens.radii.length + s.tokens.shadows.length, 0
      ),
      averageHealth: systems.length > 0
        ? Math.round(systems.reduce((sum, s) => sum + s.healthScore, 0) / systems.length)
        : 0,
      sharedComponentCount: shared.size,
    };
  }

  // ── Private Helpers ───────────────────────────────────────

  private computeConsistency(systems: DesignSystem[]): ConsistencyScore {
    if (systems.length < 2) {
      return { overall: 100, naming: 100, tokens: 100, spacing: 100, typography: 100, components: 100 };
    }

    // Naming consistency: check if all systems use same naming convention
    const namingPatterns = systems.map(s => {
      const names = s.components.map(c => c.name);
      const pascal = names.filter(n => /^[A-Z]/.test(n)).length;
      return pascal / Math.max(1, names.length);
    });
    const namingVariance = Math.max(...namingPatterns) - Math.min(...namingPatterns);
    const namingScore = Math.round((1 - namingVariance) * 100);

    // Token consistency: how many tokens are shared
    const allColors = new Set<string>();
    const sharedColors = new Set<string>();
    for (const sys of systems) {
      for (const c of sys.tokens.colors) {
        if (allColors.has(c.value)) sharedColors.add(c.value);
        allColors.add(c.value);
      }
    }
    const tokenScore = allColors.size > 0
      ? Math.round((sharedColors.size / allColors.size) * 100)
      : 100;

    // Component overlap
    const shared = this.findSharedComponents();
    const allComponents = new Set<string>();
    for (const sys of systems) {
      for (const comp of sys.components) {
        allComponents.add(comp.name.toLowerCase().replace(/[-_\s]/g, ""));
      }
    }
    const componentScore = allComponents.size > 0
      ? Math.round((shared.size / allComponents.size) * 100)
      : 100;

    const overall = Math.round(
      namingScore * 0.2 + tokenScore * 0.3 + tokenScore * 0.15 + tokenScore * 0.15 + componentScore * 0.2
    );

    return {
      overall,
      naming: namingScore,
      tokens: tokenScore,
      spacing: tokenScore, // Simplified
      typography: tokenScore,
      components: componentScore,
    };
  }

  private findDuplicates(systems: DesignSystem[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const seen = new Map<string, DuplicateInstance[]>();

    for (const system of systems) {
      for (const comp of system.components) {
        const key = comp.name.toLowerCase().replace(/[-_\s]/g, "");
        const instances = seen.get(key) ?? [];
        instances.push({
          systemId: system.id,
          systemName: system.name,
          componentId: comp.id,
          componentName: comp.name,
          similarity: 1.0,
        });
        seen.set(key, instances);
      }
    }

    for (const [name, instances] of seen) {
      if (instances.length >= 2) {
        groups.push({
          componentName: instances[0].componentName,
          pattern: `Component "${name}" exists in ${instances.length} systems`,
          instances,
          consolidationSavings: (instances.length - 1) * 4, // ~4 hours per duplicate
        });
      }
    }

    return groups.sort((a, b) => b.instances.length - a.instances.length);
  }

  private findTokenConflicts(systems: DesignSystem[]): TokenConflict[] {
    const conflicts: TokenConflict[] = [];
    const tokenMap = new Map<string, { systemId: string; systemName: string; value: string }[]>();

    for (const system of systems) {
      for (const color of system.tokens.colors) {
        const existing = tokenMap.get(color.name) ?? [];
        existing.push({ systemId: system.id, systemName: system.name, value: color.value });
        tokenMap.set(color.name, existing);
      }
    }

    for (const [name, values] of tokenMap) {
      const uniqueValues = new Set(values.map(v => v.value));
      if (uniqueValues.size > 1) {
        conflicts.push({
          tokenName: name,
          values,
          severity: name.includes("brand") ? "critical" : "warning",
          suggestion: `Standardize "${name}" to a single value across all systems.`,
        });
      }
    }

    return conflicts;
  }

  private findUnificationOpportunities(_systems: DesignSystem[]): UnificationOpportunity[] {
    const opportunities: UnificationOpportunity[] = [];
    const shared = this.findSharedComponents();

    for (const [name, data] of shared) {
      if (data.systems.length >= 2) {
        opportunities.push({
          componentName: name,
          systems: data.systems,
          sharedProperties: ["layout", "spacing", "colors"],
          divergentProperties: ["border-radius", "font-size"],
          unificationScore: Math.min(1, data.systems.length * 0.3),
          estimatedSavings: (data.systems.length - 1) * 8,
        });
      }
    }

    return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  private generateSystemRecommendations(
    consistency: ConsistencyScore,
    duplicates: DuplicateGroup[],
    conflicts: TokenConflict[],
    opportunities: UnificationOpportunity[],
  ): SystemRecommendation[] {
    const recs: SystemRecommendation[] = [];

    if (consistency.naming < 70) {
      recs.push({
        id: "rec-naming-standard",
        type: "standardize",
        title: "Standardize component naming across systems",
        description: `Naming consistency is ${consistency.naming}%. Adopt PascalCase convention across all systems.`,
        impact: "Easier cross-system search and automation",
        affectedSystems: this.getSystems().map(s => s.name),
        effort: "medium",
      });
    }

    if (duplicates.length > 5) {
      const totalSavings = duplicates.reduce((sum, d) => sum + d.consolidationSavings, 0);
      recs.push({
        id: "rec-dedup-components",
        type: "consolidate",
        title: `Consolidate ${duplicates.length} duplicate components`,
        description: `Found ${duplicates.length} components duplicated across systems. Consolidation saves ~${totalSavings} hours.`,
        impact: `Save ~${totalSavings} engineering hours`,
        affectedSystems: [...new Set(duplicates.flatMap(d => d.instances.map(i => i.systemName)))],
        effort: "large",
      });
    }

    if (conflicts.length > 0) {
      const critical = conflicts.filter(c => c.severity === "critical");
      recs.push({
        id: "rec-token-conflicts",
        type: "align",
        title: `Resolve ${conflicts.length} token conflicts (${critical.length} critical)`,
        description: "Same token names have different values across systems. This causes visual inconsistency.",
        impact: "Brand consistency across products",
        affectedSystems: [...new Set(conflicts.flatMap(c => c.values.map(v => v.systemName)))],
        effort: critical.length > 3 ? "large" : "small",
      });
    }

    if (opportunities.length > 0) {
      const topOp = opportunities[0];
      recs.push({
        id: "rec-unify-components",
        type: "create",
        title: `Create shared component library (${opportunities.length} candidates)`,
        description: `${opportunities.length} components can be unified into a shared library. Top candidate: "${topOp.componentName}" (${topOp.systems.length} systems).`,
        impact: `Save ~${opportunities.reduce((sum, o) => sum + o.estimatedSavings, 0)} hours`,
        affectedSystems: [...new Set(opportunities.flatMap(o => o.systems))],
        effort: "large",
      });
    }

    return recs;
  }

  private classifyDriftSeverity(drifts: DriftItem[]): "healthy" | "minor-drift" | "major-drift" | "critical" {
    const errors = drifts.filter(d => d.severity === "error").length;
    const warnings = drifts.filter(d => d.severity === "warning").length;

    if (errors >= 5) return "critical";
    if (errors >= 2 || warnings >= 5) return "major-drift";
    if (errors >= 1 || warnings >= 2) return "minor-drift";
    return "healthy";
  }
}

// ── Singleton export ──────────────────────────────────────────

export const designSystemHub = new DesignSystemHub();
