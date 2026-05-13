import { useState, useMemo } from "react";
import type { DesignSystemComponentInfo, DesignSystemVariableInfo, ScanResult } from "../../shared/types";
import { useI18n } from "../i18n/I18nContext";
import styles from "./UiUxEvaluationPanel.module.css";

interface UiUxEvaluationPanelProps {
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  scanResult: ScanResult | null;
}

interface EvalCriterion {
  id: string;
  category: "documentation" | "guidelines" | "testing" | "color" | "accessibility" | "states" | "icons";
  label: string;
  description: string;
  score: number;
  status: "pass" | "warn" | "fail";
  details: string;
}

function hasVar(vars: DesignSystemVariableInfo[], pattern: RegExp): boolean {
  return vars.some(v => pattern.test(v.name));
}

function evaluate(
  components: DesignSystemComponentInfo[],
  variables: DesignSystemVariableInfo[],
  scanResult: ScanResult | null,
): EvalCriterion[] {
  const results: EvalCriterion[] = [];
  const compCount = components.length;
  const varCount = variables.length;
  const catScore = (dim: string) => scanResult?.categories.find(c => c.id === dim)?.score ?? 0;

  // Documentation
  const hasDescription = components.filter(c => c.description && c.description.length > 10).length;
  const docRatio = compCount > 0 ? hasDescription / compCount : 0;
  results.push({
    id: "doc-completeness",
    category: "documentation",
    label: "Component documentation",
    description: "Components should have descriptions for developers",
    score: Math.round(docRatio * 100),
    status: docRatio >= 0.7 ? "pass" : docRatio >= 0.3 ? "warn" : "fail",
    details: `${hasDescription}/${compCount} components have descriptions`,
  });

  const hasVariants = components.filter(c => c.variantProperties && Object.keys(c.variantProperties).length > 0).length;
  const variantRatio = compCount > 0 ? hasVariants / compCount : 0;
  results.push({
    id: "doc-variants",
    category: "documentation",
    label: "Variant documentation",
    description: "Components should expose variant properties",
    score: Math.round(variantRatio * 100),
    status: variantRatio >= 0.5 ? "pass" : variantRatio >= 0.2 ? "warn" : "fail",
    details: `${hasVariants}/${compCount} components have variant properties`,
  });

  // Design Guidelines
  const spacingOk = hasVar(variables, /space|spacing|gap|padding|margin/i);
  const radiusOk = hasVar(variables, /radius|corner|rounded/i);
  const shadowOk = hasVar(variables, /shadow|elevation|depth/i);
  const guidelineCount = [spacingOk, radiusOk, shadowOk].filter(Boolean).length;
  results.push({
    id: "guide-tokens",
    category: "guidelines",
    label: "Design token coverage",
    description: "Spacing, radius, and shadow tokens should be defined",
    score: Math.round((guidelineCount / 3) * 100),
    status: guidelineCount >= 3 ? "pass" : guidelineCount >= 2 ? "warn" : "fail",
    details: [
      spacingOk ? "✓ Spacing" : "✗ Spacing",
      radiusOk ? "✓ Radius" : "✗ Radius",
      shadowOk ? "✓ Shadow" : "✗ Shadow",
    ].join(" · "),
  });

  const typographyOk = hasVar(variables, /font|type|text|heading|body|caption|line-height/i);
  results.push({
    id: "guide-typography",
    category: "guidelines",
    label: "Typography scale",
    description: "Typography hierarchy tokens (headings, body, caption)",
    score: typographyOk ? 85 : 25,
    status: typographyOk ? "pass" : "fail",
    details: typographyOk ? "Typography variables detected" : "No typography tokens found",
  });

  // Testing readiness
  const structScore = catScore("structure");
  const namingScore = catScore("naming");
  results.push({
    id: "test-structure",
    category: "testing",
    label: "Testable structure",
    description: "Clean structure and naming helps automated testing",
    score: Math.round((structScore + namingScore) / 2),
    status: structScore >= 70 && namingScore >= 70 ? "pass" : structScore >= 50 ? "warn" : "fail",
    details: `Structure: ${structScore} · Naming: ${namingScore}`,
  });

  const componentStructureScore = catScore("structure");
  results.push({
    id: "test-autolayout",
    category: "testing",
    label: "Auto Layout adoption",
    description: "Well-structured components are more predictable for testing",
    score: componentStructureScore,
    status: componentStructureScore >= 70 ? "pass" : componentStructureScore >= 40 ? "warn" : "fail",
    details: `Structure score: ${componentStructureScore} — higher means better Auto Layout usage`,
  });

  // Color
  const colorVars = variables.filter(v => /color|fill|stroke|bg|background|surface|text/i.test(v.name));
  const hasSemanticColors = colorVars.some(v => /primary|secondary|success|error|warning|info|danger/i.test(v.name));
  results.push({
    id: "color-semantic",
    category: "color",
    label: "Semantic color system",
    description: "Color variables should use semantic naming",
    score: hasSemanticColors ? 90 : colorVars.length > 5 ? 60 : 20,
    status: hasSemanticColors ? "pass" : colorVars.length > 5 ? "warn" : "fail",
    details: `${colorVars.length} color variables${hasSemanticColors ? ", semantic naming detected" : ""}`,
  });

  const hasDarkMode = hasVar(variables, /dark|night|inverse/i);
  results.push({
    id: "color-darkmode",
    category: "color",
    label: "Dark mode support",
    description: "Design system should support dark/light themes",
    score: hasDarkMode ? 85 : 30,
    status: hasDarkMode ? "pass" : "fail",
    details: hasDarkMode ? "Dark mode variables detected" : "No dark mode tokens",
  });

  // Accessibility
  const metaScore = catScore("meta");
  const completenessScore = catScore("completeness");
  results.push({
    id: "a11y-score",
    category: "accessibility",
    label: "Accessibility readiness",
    description: "Component metadata and completeness support a11y",
    score: Math.round((metaScore + completenessScore) / 2),
    status: metaScore >= 70 && completenessScore >= 70 ? "pass" : metaScore >= 50 ? "warn" : "fail",
    details: `Meta: ${metaScore} · Completeness: ${completenessScore}`,
  });

  // States
  const stateKeywords = /hover|active|disabled|focus|pressed|selected|loading|error|empty|skeleton/i;
  const hasStates = components.filter(c => {
    if (!c.variantProperties) return false;
    return Object.keys(c.variantProperties).some(k => stateKeywords.test(k)) ||
           Object.values(c.variantProperties).some(v => Array.isArray(v) && v.some(val => stateKeywords.test(val)));
  }).length;
  results.push({
    id: "states-coverage",
    category: "states",
    label: "Interactive states",
    description: "Components should cover hover, active, disabled, loading states",
    score: compCount > 0 ? Math.min(100, Math.round((hasStates / Math.max(1, compCount * 0.5)) * 100)) : 0,
    status: hasStates >= compCount * 0.4 ? "pass" : hasStates >= compCount * 0.2 ? "warn" : "fail",
    details: `${hasStates}/${compCount} components have state variants`,
  });

  // Icons
  const iconComponents = components.filter(c => /icon|ico|glyph|symbol/i.test(c.name));
  results.push({
    id: "icons-consistency",
    category: "icons",
    label: "Icon system",
    description: "Consistent icon set in the design system",
    score: iconComponents.length >= 10 ? 90 : iconComponents.length >= 5 ? 70 : iconComponents.length > 0 ? 50 : 15,
    status: iconComponents.length >= 10 ? "pass" : iconComponents.length > 0 ? "warn" : "fail",
    details: `${iconComponents.length} icon components detected`,
  });

  return results;
}

export function UiUxEvaluationPanel({ components, variables, scanResult }: UiUxEvaluationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();
  const criteria = useMemo(() => evaluate(components, variables, scanResult), [components, variables, scanResult]);
  const overallScore = Math.round(criteria.reduce((s, c) => s + c.score, 0) / criteria.length);

  const CATEGORY_LABELS: Record<string, string> = {
    documentation: t.catDocumentation,
    guidelines: t.catGuidelines,
    testing: t.catTesting,
    color: t.catColor,
    accessibility: t.catAccessibility,
    states: t.catStates,
    icons: t.catIcons,
  };

  const grouped = useMemo(() => {
    const map = new Map<string, EvalCriterion[]>();
    for (const c of criteria) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [criteria]);

  const passCount = criteria.filter(c => c.status === "pass").length;
  const warnCount = criteria.filter(c => c.status === "warn").length;
  const failCount = criteria.filter(c => c.status === "fail").length;

  return (
    <div className={styles.root}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>{t.uiUxEvaluation}</span>
          <span className={styles.badges}>
            {passCount > 0 && <span className={styles.badgePass}>{passCount} {t.pass}</span>}
            {warnCount > 0 && <span className={styles.badgeWarn}>{warnCount} {t.warn}</span>}
            {failCount > 0 && <span className={styles.badgeFail}>{failCount} {t.fail}</span>}
          </span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.overallScore} ${overallScore >= 70 ? styles.green : overallScore >= 45 ? styles.yellow : styles.red}`}>
            {overallScore}%
          </span>
          <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.body}>
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className={styles.group}>
              <span className={styles.groupLabel}>{CATEGORY_LABELS[cat] ?? cat}</span>
              {items.map(item => (
                <div key={item.id} className={styles.criterion}>
                  <div className={styles.criterionHeader}>
                    <span className={`${styles.indicator} ${styles[item.status]}`} />
                    <span className={styles.criterionLabel}>{item.label}</span>
                    <span className={`${styles.criterionScore} ${item.score >= 70 ? styles.green : item.score >= 45 ? styles.yellow : styles.red}`}>
                      {item.score}%
                    </span>
                  </div>
                  <span className={styles.criterionDetails}>{item.details}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
