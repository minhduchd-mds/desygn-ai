/**
 * designAnalyzer — Design System Intelligence & Auditing.
 *
 * Competitive Advantage vs Figma:
 *   Figma generates code. Design-md-ai AUDITS and OPTIMIZES your design system.
 *   This module provides intelligence that Figma's code gen cannot:
 *
 *   1. Cross-component pattern detection
 *   2. Design token consolidation recommendations
 *   3. Accessibility coverage scoring
 *   4. Component reuse analysis
 *   5. Naming consistency audit
 *   6. Design debt calculation ($$ impact)
 *
 * Usage:
 *   const analyzer = new DesignAnalyzer();
 *   const report = analyzer.analyze(scanResults, projectConfig);
 *   // report.score = 72/100
 *   // report.recommendations = ["Consolidate 3 similar Button variants", ...]
 */

import type { ScanResult, ScanIssue, SerializedNode } from "../../../shared/types";

// ── Types ─────────────────────────────────────────────────────

export interface DesignSystemReport {
  score: number;              // 0-100 overall health score
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: DimensionScore[];
  patterns: DetectedPattern[];
  recommendations: Recommendation[];
  metrics: DesignMetrics;
  tokenAnalysis: TokenAnalysis;
  accessibility: AccessibilityReport;
  debtEstimate: DesignDebt;
}

export interface DimensionScore {
  name: string;
  score: number;        // 0-100
  weight: number;       // 0-1
  issues: string[];
}

export interface DetectedPattern {
  id: string;
  name: string;
  type: PatternType;
  occurrences: number;
  components: string[];
  confidence: number;   // 0-1
  description: string;
}

export type PatternType =
  | "repeated-layout"      // Same flex/grid pattern in multiple components
  | "color-cluster"        // Similar colors that should be consolidated
  | "spacing-pattern"      // Consistent spacing values
  | "typography-group"     // Font size/weight clusters
  | "naming-convention"    // Detected naming pattern
  | "component-variant"    // Components that could be variants of each other
  | "unused-token"         // Tokens defined but never used
  | "orphan-component";    // Components not used in any composition

export interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  category: RecommendationCategory;
  title: string;
  description: string;
  impact: string;         // e.g. "Reduces component count by 30%"
  effort: "trivial" | "small" | "medium" | "large";
  affectedComponents: string[];
}

export type RecommendationCategory =
  | "consolidation"    // Merge similar components
  | "naming"           // Fix naming inconsistencies
  | "tokens"           // Token optimization
  | "accessibility"    // A11y improvements
  | "structure"        // Layout/hierarchy improvements
  | "performance"      // Render performance
  | "documentation";   // Missing docs/descriptions

export interface DesignMetrics {
  totalComponents: number;
  uniqueColors: number;
  uniqueFonts: number;
  uniqueSpacings: number;
  averageDepth: number;
  maxDepth: number;
  componentReuse: number;     // % of components reused
  tokenCoverage: number;      // % of values using tokens
  variantCoverage: number;    // % of components with variants
  responsiveReady: number;    // % with responsive variants
}

export interface TokenAnalysis {
  colors: TokenGroup[];
  spacings: TokenGroup[];
  typography: TokenGroup[];
  radii: TokenGroup[];
  shadows: TokenGroup[];
  consolidationOpportunities: number;
}

export interface TokenGroup {
  name: string;
  values: string[];
  usage: number;          // How many times used
  similar: string[];      // Similar values that could be merged
}

export interface AccessibilityReport {
  score: number;          // 0-100
  colorContrast: { pass: number; fail: number; unknown: number };
  textSizing: { pass: number; fail: number };
  touchTargets: { pass: number; fail: number };
  missingLabels: string[];
}

export interface DesignDebt {
  score: number;          // 0-100 (higher = more debt)
  estimatedHours: number; // Hours to fix all issues
  costEstimate: string;   // "$X,XXX" based on $100/hr
  categories: { category: string; hours: number; items: number }[];
}

// ── Analyzer Implementation ───────────────────────────────────

export class DesignAnalyzer {

  /**
   * Run full analysis on scan results.
   */
  analyze(scanResults: ScanResult[], nodes?: SerializedNode[]): DesignSystemReport {
    const dimensions = this.scoreDimensions(scanResults);
    const patterns = this.detectPatterns(scanResults, nodes);
    const metrics = this.computeMetrics(scanResults, nodes);
    const tokenAnalysis = this.analyzeTokens(scanResults, nodes);
    const accessibility = this.analyzeAccessibility(nodes);
    const recommendations = this.generateRecommendations(dimensions, patterns, metrics, tokenAnalysis);
    const debtEstimate = this.estimateDebt(recommendations);

    const weightedScore = dimensions.reduce(
      (sum, d) => sum + d.score * d.weight, 0
    );
    const score = Math.round(weightedScore);

    return {
      score,
      grade: this.scoreToGrade(score),
      dimensions,
      patterns,
      recommendations,
      metrics,
      tokenAnalysis,
      accessibility,
      debtEstimate,
    };
  }

  // ── Dimension Scoring ───────────────────────────────────────

  private scoreDimensions(results: ScanResult[]): DimensionScore[] {
    const allIssues = results.flatMap(r => r.issues ?? []);

    return [
      this.scoreConsistency(allIssues),
      this.scoreCompleteness(results),
      this.scoreTokenUsage(allIssues),
      this.scoreNaming(allIssues),
      this.scoreStructure(allIssues),
      this.scoreDocumentation(results),
    ];
  }

  private scoreConsistency(issues: ScanIssue[]): DimensionScore {
    const related = issues.filter(i =>
      i.category === "structure" || i.message.toLowerCase().includes("inconsisten")
    );
    const score = Math.max(0, 100 - related.length * 8);
    return {
      name: "Consistency",
      score,
      weight: 0.25,
      issues: related.map(i => i.message),
    };
  }

  private scoreCompleteness(results: ScanResult[]): DimensionScore {
    const issues: string[] = [];
    let total = 0;
    let complete = 0;

    for (const r of results) {
      total++;
      const hasVariants = (r.variants?.length ?? 0) > 0;
      const hasTokens = (r.tokenCoverage ?? 0) > 0.5;
      if (hasVariants && hasTokens) complete++;
      else {
        if (!hasVariants) issues.push(`${r.componentName ?? "Component"}: Missing variants`);
        if (!hasTokens) issues.push(`${r.componentName ?? "Component"}: Low token coverage`);
      }
    }

    const score = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { name: "Completeness", score, weight: 0.2, issues: issues.slice(0, 10) };
  }

  private scoreTokenUsage(issues: ScanIssue[]): DimensionScore {
    const related = issues.filter(i => i.category === "tokens");
    const score = Math.max(0, 100 - related.length * 5);
    return {
      name: "Token Usage",
      score,
      weight: 0.2,
      issues: related.map(i => i.message).slice(0, 10),
    };
  }

  private scoreNaming(issues: ScanIssue[]): DimensionScore {
    const related = issues.filter(i => i.category === "naming");
    const score = Math.max(0, 100 - related.length * 10);
    return {
      name: "Naming",
      score,
      weight: 0.15,
      issues: related.map(i => i.message).slice(0, 10),
    };
  }

  private scoreStructure(issues: ScanIssue[]): DimensionScore {
    const related = issues.filter(i => i.category === "structure");
    const score = Math.max(0, 100 - related.length * 7);
    return {
      name: "Structure",
      score,
      weight: 0.1,
      issues: related.map(i => i.message).slice(0, 10),
    };
  }

  private scoreDocumentation(results: ScanResult[]): DimensionScore {
    const issues: string[] = [];
    let documented = 0;

    for (const r of results) {
      if (r.componentDescription || r.metaScore > 0.5) {
        documented++;
      } else {
        issues.push(`${r.componentName ?? "Component"}: Missing description`);
      }
    }

    const score = results.length > 0 ? Math.round((documented / results.length) * 100) : 0;
    return { name: "Documentation", score, weight: 0.1, issues: issues.slice(0, 10) };
  }

  // ── Pattern Detection ───────────────────────────────────────

  private detectPatterns(results: ScanResult[], nodes?: SerializedNode[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Detect repeated layouts
    patterns.push(...this.detectLayoutPatterns(nodes));

    // Detect color clusters
    patterns.push(...this.detectColorClusters(nodes));

    // Detect naming conventions
    patterns.push(...this.detectNamingConventions(results));

    // Detect potential variant consolidation
    patterns.push(...this.detectVariantOpportunities(results));

    return patterns;
  }

  private detectLayoutPatterns(nodes?: SerializedNode[]): DetectedPattern[] {
    if (!nodes?.length) return [];

    const layoutMap = new Map<string, string[]>();

    const traverse = (node: SerializedNode) => {
      if (node.layoutMode) {
        const key = `${node.layoutMode}-${node.itemSpacing ?? 0}-${node.paddingTop ?? 0}`;
        const existing = layoutMap.get(key) ?? [];
        existing.push(node.name);
        layoutMap.set(key, existing);
      }
      if (node.children) {
        for (const child of node.children) traverse(child);
      }
    };

    for (const node of nodes) traverse(node);

    const patterns: DetectedPattern[] = [];
    for (const [key, components] of layoutMap) {
      if (components.length >= 3) {
        patterns.push({
          id: `layout-${key}`,
          name: `Repeated Layout: ${key}`,
          type: "repeated-layout",
          occurrences: components.length,
          components,
          confidence: Math.min(1, components.length * 0.15),
          description: `${components.length} components share the same layout pattern (${key}). Consider extracting a shared layout component.`,
        });
      }
    }

    return patterns;
  }

  private detectColorClusters(nodes?: SerializedNode[]): DetectedPattern[] {
    if (!nodes?.length) return [];

    const colors = new Map<string, string[]>();

    const traverse = (node: SerializedNode) => {
      if (node.fills) {
        for (const fill of node.fills) {
          if (fill.type === "SOLID" && fill.color) {
            const hex = this.rgbToHex(fill.color);
            const existing = colors.get(hex) ?? [];
            existing.push(node.name);
            colors.set(hex, existing);
          }
        }
      }
      if (node.children) {
        for (const child of node.children) traverse(child);
      }
    };

    for (const node of nodes) traverse(node);

    // Find similar colors that could be consolidated
    const patterns: DetectedPattern[] = [];
    const colorArr = [...colors.entries()];

    for (let i = 0; i < colorArr.length; i++) {
      const similar: string[] = [];
      for (let j = i + 1; j < colorArr.length; j++) {
        if (this.colorDistance(colorArr[i][0], colorArr[j][0]) < 15) {
          similar.push(colorArr[j][0]);
        }
      }
      if (similar.length > 0) {
        patterns.push({
          id: `color-${colorArr[i][0]}`,
          name: `Color Cluster: ${colorArr[i][0]}`,
          type: "color-cluster",
          occurrences: similar.length + 1,
          components: [...colorArr[i][1], ...similar.flatMap(s => colors.get(s) ?? [])],
          confidence: 0.7,
          description: `${similar.length + 1} similar colors found. Consider consolidating into a single design token.`,
        });
      }
    }

    return patterns.slice(0, 10); // Limit to top 10
  }

  private detectNamingConventions(results: ScanResult[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const names = results.map(r => r.componentName).filter(Boolean) as string[];

    // Check for PascalCase consistency
    const pascalCount = names.filter(n => /^[A-Z][a-zA-Z0-9]+$/.test(n)).length;
    const kebabCount = names.filter(n => /^[a-z]+(-[a-z]+)+$/.test(n)).length;

    if (pascalCount > 0 && kebabCount > 0) {
      patterns.push({
        id: "naming-mixed",
        name: "Mixed Naming Convention",
        type: "naming-convention",
        occurrences: names.length,
        components: names,
        confidence: 0.9,
        description: `Found ${pascalCount} PascalCase and ${kebabCount} kebab-case components. Standardize naming.`,
      });
    }

    return patterns;
  }

  private detectVariantOpportunities(results: ScanResult[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Group by similar names (e.g. "ButtonPrimary", "ButtonSecondary")
    const groups = new Map<string, string[]>();
    for (const r of results) {
      const name = r.componentName ?? "";
      // Extract base name (remove suffixes like Primary, Secondary, Large, Small)
      const base = name.replace(/(Primary|Secondary|Tertiary|Large|Medium|Small|Disabled|Active|Hover)$/i, "");
      if (base !== name && base.length > 2) {
        const existing = groups.get(base) ?? [];
        existing.push(name);
        groups.set(base, existing);
      }
    }

    for (const [base, components] of groups) {
      if (components.length >= 2) {
        patterns.push({
          id: `variant-${base}`,
          name: `Variant Opportunity: ${base}`,
          type: "component-variant",
          occurrences: components.length,
          components,
          confidence: 0.8,
          description: `${components.length} components (${components.join(", ")}) could be variants of "${base}".`,
        });
      }
    }

    return patterns;
  }

  // ── Metrics Computation ─────────────────────────────────────

  private computeMetrics(results: ScanResult[], nodes?: SerializedNode[]): DesignMetrics {
    const colors = new Set<string>();
    const fonts = new Set<string>();
    const spacings = new Set<number>();
    let totalDepth = 0;
    let maxDepth = 0;

    const traverse = (node: SerializedNode, depth: number) => {
      totalDepth += depth;
      maxDepth = Math.max(maxDepth, depth);

      if (node.fills) {
        for (const fill of node.fills) {
          if (fill.type === "SOLID" && fill.color) colors.add(this.rgbToHex(fill.color));
        }
      }
      if (node.fontName) fonts.add(`${node.fontName.family}-${node.fontName.style}`);
      if (node.itemSpacing) spacings.add(node.itemSpacing);
      if (node.paddingTop) spacings.add(node.paddingTop);

      if (node.children) {
        for (const child of node.children) traverse(child, depth + 1);
      }
    };

    if (nodes) {
      for (const node of nodes) traverse(node, 0);
    }

    const nodeCount = nodes?.length ?? results.length;
    const withVariants = results.filter(r => (r.variants?.length ?? 0) > 0).length;
    const tokenCoverage = results.reduce((sum, r) => sum + (r.tokenCoverage ?? 0), 0) / Math.max(1, results.length);

    return {
      totalComponents: results.length,
      uniqueColors: colors.size,
      uniqueFonts: fonts.size,
      uniqueSpacings: spacings.size,
      averageDepth: nodeCount > 0 ? Math.round(totalDepth / nodeCount) : 0,
      maxDepth,
      componentReuse: 0, // Requires full file analysis
      tokenCoverage: Math.round(tokenCoverage * 100),
      variantCoverage: results.length > 0 ? Math.round((withVariants / results.length) * 100) : 0,
      responsiveReady: results.filter(r => (r.variants?.length ?? 0) > 1).length,
    };
  }

  // ── Token Analysis ──────────────────────────────────────────

  private analyzeTokens(results: ScanResult[], nodes?: SerializedNode[]): TokenAnalysis {
    const colors: TokenGroup[] = [];
    const spacings: TokenGroup[] = [];

    // Simplified token analysis
    const colorMap = new Map<string, number>();
    const spacingMap = new Map<number, number>();

    const traverse = (node: SerializedNode) => {
      if (node.fills) {
        for (const fill of node.fills) {
          if (fill.type === "SOLID" && fill.color) {
            const hex = this.rgbToHex(fill.color);
            colorMap.set(hex, (colorMap.get(hex) ?? 0) + 1);
          }
        }
      }
      if (node.itemSpacing) spacingMap.set(node.itemSpacing, (spacingMap.get(node.itemSpacing) ?? 0) + 1);
      if (node.children) for (const child of node.children) traverse(child);
    };

    if (nodes) for (const node of nodes) traverse(node);

    for (const [color, usage] of colorMap) {
      colors.push({ name: color, values: [color], usage, similar: [] });
    }

    for (const [spacing, usage] of spacingMap) {
      spacings.push({ name: `${spacing}px`, values: [`${spacing}`], usage, similar: [] });
    }

    return {
      colors,
      spacings,
      typography: [],
      radii: [],
      shadows: [],
      consolidationOpportunities: colors.filter(c => c.usage === 1).length,
    };
  }

  // ── Accessibility Analysis ──────────────────────────────────

  private analyzeAccessibility(nodes?: SerializedNode[]): AccessibilityReport {
    let textPass = 0;
    let textFail = 0;
    let touchPass = 0;
    let touchFail = 0;
    const missingLabels: string[] = [];

    const traverse = (node: SerializedNode) => {
      // Text sizing check (min 12px)
      if (node.fontSize) {
        if (node.fontSize >= 12) textPass++;
        else textFail++;
      }

      // Touch target check (min 44x44)
      if (node.type === "INSTANCE" || node.type === "COMPONENT") {
        if ((node.width ?? 0) >= 44 && (node.height ?? 0) >= 44) touchPass++;
        else {
          touchFail++;
          if ((node.width ?? 0) < 44 || (node.height ?? 0) < 44) {
            missingLabels.push(`${node.name}: Touch target too small (${node.width}x${node.height})`);
          }
        }
      }

      if (node.children) for (const child of node.children) traverse(child);
    };

    if (nodes) for (const node of nodes) traverse(node);

    const total = textPass + textFail + touchPass + touchFail;
    const passed = textPass + touchPass;
    const score = total > 0 ? Math.round((passed / total) * 100) : 50;

    return {
      score,
      colorContrast: { pass: 0, fail: 0, unknown: total }, // Requires contrast calculation
      textSizing: { pass: textPass, fail: textFail },
      touchTargets: { pass: touchPass, fail: touchFail },
      missingLabels: missingLabels.slice(0, 20),
    };
  }

  // ── Recommendations ─────────────────────────────────────────

  private generateRecommendations(
    dimensions: DimensionScore[],
    patterns: DetectedPattern[],
    metrics: DesignMetrics,
    _tokenAnalysis: TokenAnalysis,
  ): Recommendation[] {
    const recs: Recommendation[] = [];

    // From dimensions
    for (const dim of dimensions) {
      if (dim.score < 60) {
        recs.push({
          id: `dim-${dim.name.toLowerCase()}`,
          priority: dim.score < 30 ? "critical" : "high",
          category: "consolidation",
          title: `Improve ${dim.name} (${dim.score}/100)`,
          description: `${dim.name} score is below threshold. ${dim.issues[0] ?? "Review and fix issues."}`,
          impact: `+${Math.round((100 - dim.score) * dim.weight)} overall score improvement`,
          effort: dim.issues.length > 10 ? "large" : "medium",
          affectedComponents: [],
        });
      }
    }

    // From patterns
    for (const pattern of patterns) {
      if (pattern.type === "color-cluster") {
        recs.push({
          id: `rec-${pattern.id}`,
          priority: "medium",
          category: "tokens",
          title: `Consolidate ${pattern.occurrences} similar colors`,
          description: pattern.description,
          impact: `Reduces unique colors by ${pattern.occurrences - 1}`,
          effort: "small",
          affectedComponents: pattern.components,
        });
      }

      if (pattern.type === "component-variant") {
        recs.push({
          id: `rec-${pattern.id}`,
          priority: "high",
          category: "consolidation",
          title: `Create variant for ${pattern.name.replace("Variant Opportunity: ", "")}`,
          description: pattern.description,
          impact: `Reduces component count by ${pattern.occurrences - 1}`,
          effort: "medium",
          affectedComponents: pattern.components,
        });
      }
    }

    // From metrics
    if (metrics.tokenCoverage < 50) {
      recs.push({
        id: "rec-token-coverage",
        priority: "critical",
        category: "tokens",
        title: "Increase design token coverage",
        description: `Only ${metrics.tokenCoverage}% of values use design tokens. Target: >80%.`,
        impact: "Consistent theming, easier maintenance",
        effort: "large",
        affectedComponents: [],
      });
    }

    if (metrics.variantCoverage < 30) {
      recs.push({
        id: "rec-variant-coverage",
        priority: "high",
        category: "documentation",
        title: "Add responsive variants",
        description: `Only ${metrics.variantCoverage}% of components have variants.`,
        impact: "Better responsive support, more complete code gen",
        effort: "medium",
        affectedComponents: [],
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recs;
  }

  // ── Design Debt Estimation ──────────────────────────────────

  private estimateDebt(recommendations: Recommendation[]): DesignDebt {
    const effortHours = { trivial: 0.5, small: 2, medium: 8, large: 24 };
    const categories = new Map<string, { hours: number; items: number }>();

    let totalHours = 0;
    for (const rec of recommendations) {
      const hours = effortHours[rec.effort];
      totalHours += hours;

      const cat = categories.get(rec.category) ?? { hours: 0, items: 0 };
      cat.hours += hours;
      cat.items++;
      categories.set(rec.category, cat);
    }

    const score = Math.min(100, Math.round(totalHours * 2)); // rough mapping
    const costEstimate = `$${(totalHours * 100).toLocaleString()}`; // $100/hr

    return {
      score,
      estimatedHours: Math.round(totalHours),
      costEstimate,
      categories: [...categories.entries()].map(([category, data]) => ({
        category,
        hours: Math.round(data.hours),
        items: data.items,
      })),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  private rgbToHex(color: { r: number; g: number; b: number }): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  private colorDistance(hex1: string, hex2: string): number {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }
}

export const designAnalyzer = new DesignAnalyzer();
