/**
 * mobileSupport — Mobile-first design intelligence.
 *
 * Provides:
 *   • Viewport classification (mobile/tablet/desktop/tv)
 *   • Touch target validation (WCAG 2.2 minimum 24x24px, recommended 44x44px)
 *   • Responsive breakpoint analysis
 *   • Mobile performance budget estimation
 *   • Platform-specific code generation hints (iOS/Android/PWA)
 *   • Gesture detection from design patterns
 */

// ── Types ────────────────────────────────────────────────────────

export type ViewportClass = "mobile" | "tablet" | "desktop" | "tv";
export type PlatformTarget = "ios" | "android" | "pwa" | "responsive-web" | "react-native" | "flutter";
export type GestureType = "tap" | "long-press" | "swipe" | "pinch" | "drag" | "scroll";

export interface ViewportBreakpoint {
  name: string;
  minWidth: number;
  maxWidth: number;
  class: ViewportClass;
  orientation: "portrait" | "landscape" | "any";
}

export interface TouchTargetResult {
  nodeId: string;
  nodeName: string;
  width: number;
  height: number;
  meets24px: boolean;     // WCAG 2.2 minimum
  meets44px: boolean;     // Apple HIG / Material recommended
  issue?: string;
}

export interface ResponsiveAnalysis {
  viewportClass: ViewportClass;
  breakpoints: ViewportBreakpoint[];
  touchTargets: TouchTargetResult[];
  issues: ResponsiveIssue[];
  score: number;
  recommendations: string[];
}

export interface ResponsiveIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  nodeId?: string;
  suggestion: string;
}

export interface MobilePerformanceBudget {
  maxBundleSizeKb: number;
  maxImageSizeKb: number;
  maxFontCount: number;
  maxCSSRules: number;
  targetFCP: number;       // First Contentful Paint (ms)
  targetLCP: number;       // Largest Contentful Paint (ms)
  targetCLS: number;       // Cumulative Layout Shift
}

export interface PlatformHint {
  platform: PlatformTarget;
  safeAreaInsets: boolean;
  statusBarOverlay: boolean;
  navigationPattern: "tab-bar" | "drawer" | "bottom-nav" | "stack";
  gestureHints: GestureType[];
  specificNotes: string[];
}

// ── Constants ────────────────────────────────────────────────────

export const DEFAULT_BREAKPOINTS: ViewportBreakpoint[] = [
  { name: "mobile-s",  minWidth: 320,  maxWidth: 374,  class: "mobile",  orientation: "portrait" },
  { name: "mobile-m",  minWidth: 375,  maxWidth: 424,  class: "mobile",  orientation: "portrait" },
  { name: "mobile-l",  minWidth: 425,  maxWidth: 599,  class: "mobile",  orientation: "any" },
  { name: "tablet",    minWidth: 600,  maxWidth: 1023, class: "tablet",  orientation: "any" },
  { name: "desktop",   minWidth: 1024, maxWidth: 1439, class: "desktop", orientation: "landscape" },
  { name: "desktop-l", minWidth: 1440, maxWidth: 2559, class: "desktop", orientation: "landscape" },
  { name: "tv",        minWidth: 2560, maxWidth: 9999, class: "tv",      orientation: "landscape" },
];

export const PERFORMANCE_BUDGETS: Record<ViewportClass, MobilePerformanceBudget> = {
  mobile: {
    maxBundleSizeKb: 150,
    maxImageSizeKb: 200,
    maxFontCount: 2,
    maxCSSRules: 500,
    targetFCP: 1800,
    targetLCP: 2500,
    targetCLS: 0.1,
  },
  tablet: {
    maxBundleSizeKb: 300,
    maxImageSizeKb: 400,
    maxFontCount: 3,
    maxCSSRules: 800,
    targetFCP: 2000,
    targetLCP: 3000,
    targetCLS: 0.1,
  },
  desktop: {
    maxBundleSizeKb: 500,
    maxImageSizeKb: 800,
    maxFontCount: 4,
    maxCSSRules: 1500,
    targetFCP: 1500,
    targetLCP: 2500,
    targetCLS: 0.1,
  },
  tv: {
    maxBundleSizeKb: 1000,
    maxImageSizeKb: 2000,
    maxFontCount: 3,
    maxCSSRules: 800,
    targetFCP: 3000,
    targetLCP: 4000,
    targetCLS: 0.05,
  },
};

// ── Viewport Classifier ──────────────────────────────────────────

export function classifyViewport(width: number): ViewportClass {
  if (width < 600) return "mobile";
  if (width < 1024) return "tablet";
  if (width < 2560) return "desktop";
  return "tv";
}

export function getBreakpoint(width: number): ViewportBreakpoint {
  for (const bp of DEFAULT_BREAKPOINTS) {
    if (width >= bp.minWidth && width <= bp.maxWidth) return bp;
  }
  return DEFAULT_BREAKPOINTS[DEFAULT_BREAKPOINTS.length - 1];
}

// ── Touch Target Analyzer ────────────────────────────────────────

export interface InteractiveNode {
  id: string;
  name: string;
  width: number;
  height: number;
  type: string;
}

export function analyzeTouchTargets(nodes: InteractiveNode[]): TouchTargetResult[] {
  return nodes.map(node => {
    const meets24 = node.width >= 24 && node.height >= 24;
    const meets44 = node.width >= 44 && node.height >= 44;

    let issue: string | undefined;
    if (!meets24) {
      issue = `Touch target ${node.width}x${node.height}px is below WCAG 2.2 minimum (24x24px)`;
    } else if (!meets44) {
      issue = `Touch target ${node.width}x${node.height}px is below recommended size (44x44px)`;
    }

    return {
      nodeId: node.id,
      nodeName: node.name,
      width: node.width,
      height: node.height,
      meets24px: meets24,
      meets44px: meets44,
      issue,
    };
  });
}

// ── Responsive Analyzer ──────────────────────────────────────────

export function analyzeResponsive(
  designWidth: number,
  nodes: InteractiveNode[],
  options: { targetPlatforms?: PlatformTarget[] } = {},
): ResponsiveAnalysis {
  const viewportClass = classifyViewport(designWidth);
  const touchResults = analyzeTouchTargets(nodes);
  const issues: ResponsiveIssue[] = [];
  const recommendations: string[] = [];

  // Check touch targets
  const failedTouch24 = touchResults.filter(t => !t.meets24px);
  const failedTouch44 = touchResults.filter(t => t.meets24px && !t.meets44px);

  if (failedTouch24.length > 0) {
    issues.push({
      id: "touch-critical",
      severity: "critical",
      message: `${failedTouch24.length} interactive elements below minimum touch target (24px)`,
      suggestion: "Increase size to at least 24x24px (WCAG 2.2)",
    });
  }

  if (failedTouch44.length > 0) {
    issues.push({
      id: "touch-warning",
      severity: "warning",
      message: `${failedTouch44.length} elements below recommended touch target (44px)`,
      suggestion: "Consider increasing to 44x44px for better mobile usability",
    });
  }

  // Check viewport appropriateness
  if (viewportClass === "mobile" && designWidth > 428) {
    issues.push({
      id: "viewport-wide",
      severity: "warning",
      message: `Design width ${designWidth}px may be too wide for mobile`,
      suggestion: "Consider designing at 375px or 390px for iPhone targets",
    });
  }

  // Platform-specific recommendations
  const platforms = options.targetPlatforms ?? ["responsive-web"];
  if (platforms.includes("ios")) {
    recommendations.push("Add safe area inset handling for iPhone notch/Dynamic Island");
    recommendations.push("Use SF Pro font stack for iOS native feel");
  }
  if (platforms.includes("android")) {
    recommendations.push("Add edge-to-edge layout support for Android 15+");
    recommendations.push("Use Material 3 dynamic color tokens");
  }
  if (platforms.includes("pwa")) {
    recommendations.push("Add viewport meta tag with viewport-fit=cover");
    recommendations.push("Include manifest.json with display: standalone");
  }

  // Responsive layout checks
  if (viewportClass === "desktop" && nodes.length > 20) {
    recommendations.push("Consider progressive disclosure for mobile — hide secondary actions");
  }

  // Score calculation
  const totalInteractive = nodes.length || 1;
  const touchScore = ((totalInteractive - failedTouch24.length - failedTouch44.length * 0.5) / totalInteractive) * 100;
  const issueScore = Math.max(0, 100 - issues.filter(i => i.severity === "critical").length * 20 - issues.filter(i => i.severity === "warning").length * 5);
  const score = Math.round((touchScore + issueScore) / 2);

  return {
    viewportClass,
    breakpoints: DEFAULT_BREAKPOINTS,
    touchTargets: touchResults,
    issues,
    score,
    recommendations,
  };
}

// ── Platform Hints ───────────────────────────────────────────────

export function getPlatformHints(platform: PlatformTarget): PlatformHint {
  switch (platform) {
    case "ios":
      return {
        platform: "ios",
        safeAreaInsets: true,
        statusBarOverlay: true,
        navigationPattern: "tab-bar",
        gestureHints: ["swipe", "long-press", "pinch"],
        specificNotes: [
          "Use 44pt minimum touch targets (Apple HIG)",
          "Support Dynamic Type for accessibility",
          "Handle safe area insets for all screen sizes",
          "Support dark mode with semantic colors",
        ],
      };
    case "android":
      return {
        platform: "android",
        safeAreaInsets: true,
        statusBarOverlay: true,
        navigationPattern: "bottom-nav",
        gestureHints: ["swipe", "long-press", "drag"],
        specificNotes: [
          "Use 48dp minimum touch targets (Material Design)",
          "Support predictive back gesture (Android 14+)",
          "Handle edge-to-edge display",
          "Use Material 3 shape and color tokens",
        ],
      };
    case "pwa":
      return {
        platform: "pwa",
        safeAreaInsets: true,
        statusBarOverlay: false,
        navigationPattern: "bottom-nav",
        gestureHints: ["tap", "scroll", "swipe"],
        specificNotes: [
          "Implement service worker for offline support",
          "Use viewport units (dvh) for mobile browsers",
          "Handle install prompt for Add to Home Screen",
          "Optimize for Core Web Vitals",
        ],
      };
    case "react-native":
      return {
        platform: "react-native",
        safeAreaInsets: true,
        statusBarOverlay: true,
        navigationPattern: "stack",
        gestureHints: ["tap", "swipe", "long-press", "pinch"],
        specificNotes: [
          "Use SafeAreaView for notch handling",
          "Prefer FlatList over ScrollView for large lists",
          "Use react-native-reanimated for smooth animations",
          "Implement platform-specific code with Platform.select()",
        ],
      };
    case "flutter":
      return {
        platform: "flutter",
        safeAreaInsets: true,
        statusBarOverlay: true,
        navigationPattern: "bottom-nav",
        gestureHints: ["tap", "swipe", "drag", "pinch"],
        specificNotes: [
          "Use SafeArea widget for notch handling",
          "Implement adaptive layout with LayoutBuilder",
          "Use MediaQuery for responsive breakpoints",
          "Follow Material 3 guidelines for cross-platform consistency",
        ],
      };
    default:
      return {
        platform: "responsive-web",
        safeAreaInsets: false,
        statusBarOverlay: false,
        navigationPattern: "drawer",
        gestureHints: ["tap", "scroll"],
        specificNotes: [
          "Use CSS container queries for component-level responsiveness",
          "Implement mobile-first CSS with min-width breakpoints",
          "Use CSS Grid for complex layouts",
          "Test on real devices, not just browser dev tools",
        ],
      };
  }
}

// ── Performance Budget Checker ───────────────────────────────────

export function checkPerformanceBudget(
  viewport: ViewportClass,
  metrics: Partial<MobilePerformanceBudget>,
): { passes: boolean; violations: string[] } {
  const budget = PERFORMANCE_BUDGETS[viewport];
  const violations: string[] = [];

  if (metrics.maxBundleSizeKb && metrics.maxBundleSizeKb > budget.maxBundleSizeKb) {
    violations.push(`Bundle size ${metrics.maxBundleSizeKb}KB exceeds budget ${budget.maxBundleSizeKb}KB`);
  }
  if (metrics.maxImageSizeKb && metrics.maxImageSizeKb > budget.maxImageSizeKb) {
    violations.push(`Image size ${metrics.maxImageSizeKb}KB exceeds budget ${budget.maxImageSizeKb}KB`);
  }
  if (metrics.maxFontCount && metrics.maxFontCount > budget.maxFontCount) {
    violations.push(`${metrics.maxFontCount} fonts exceed budget of ${budget.maxFontCount}`);
  }
  if (metrics.targetFCP && metrics.targetFCP > budget.targetFCP) {
    violations.push(`FCP ${metrics.targetFCP}ms exceeds target ${budget.targetFCP}ms`);
  }
  if (metrics.targetLCP && metrics.targetLCP > budget.targetLCP) {
    violations.push(`LCP ${metrics.targetLCP}ms exceeds target ${budget.targetLCP}ms`);
  }

  return { passes: violations.length === 0, violations };
}
