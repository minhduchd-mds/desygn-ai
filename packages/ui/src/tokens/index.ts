/**
 * tokens — Design system tokens (TypeScript companion).
 *
 * Source of truth: src/tokens/tokens.css (CSS variables).
 * Palette values are available for programmatic work, while reusable UI should
 * prefer the semantic aliases exported below.
 */

export const colors = {
  primary: {
    50: "oklch(0.97 0.02 295)",
    100: "oklch(0.94 0.04 295)",
    200: "oklch(0.87 0.08 295)",
    300: "oklch(0.78 0.13 295)",
    400: "oklch(0.68 0.18 295)",
    500: "oklch(0.58 0.22 295)",
    600: "oklch(0.49 0.22 295)",
    700: "oklch(0.41 0.20 295)",
    800: "oklch(0.34 0.17 295)",
    900: "oklch(0.28 0.13 295)",
  },
  slate: {
    50: "oklch(0.98 0.005 250)",
    100: "oklch(0.95 0.008 250)",
    200: "oklch(0.90 0.012 250)",
    300: "oklch(0.82 0.018 250)",
    400: "oklch(0.71 0.025 250)",
    500: "oklch(0.59 0.030 250)",
    600: "oklch(0.48 0.030 250)",
    700: "oklch(0.39 0.028 250)",
    800: "oklch(0.30 0.025 250)",
    900: "oklch(0.22 0.020 250)",
    950: "oklch(0.16 0.015 250)",
  },
  success: "oklch(0.65 0.18 145)",
  warning: "oklch(0.75 0.16 80)",
  error: "oklch(0.62 0.22 28)",
  info: "oklch(0.65 0.16 230)",
  onStrong: "oklch(1 0 0)",
} as const;

/** CSS-variable references for theme-aware component styling. */
export const semantic = {
  surface: {
    background: "var(--surface-bg)",
    foreground: "var(--surface-fg)",
    muted: "var(--surface-muted)",
    border: "var(--surface-border)",
    ring: "var(--surface-ring)",
    overlay: "var(--surface-overlay)",
    onStrong: "var(--surface-on-strong)",
  },
  action: {
    primary: "var(--action-primary-bg)",
    primaryHover: "var(--action-primary-bg-hover)",
    secondary: "var(--action-secondary-bg)",
    secondaryHover: "var(--action-secondary-bg-hover)",
    secondaryForeground: "var(--action-secondary-fg)",
    danger: "var(--action-danger-bg)",
  },
  status: {
    neutralBackground: "var(--status-neutral-bg)",
    neutralForeground: "var(--status-neutral-fg)",
    successBackground: "var(--status-success-bg)",
    successForeground: "var(--status-success-fg)",
    warningBackground: "var(--status-warning-bg)",
    warningForeground: "var(--status-warning-fg)",
    errorBackground: "var(--status-error-bg)",
    errorForeground: "var(--status-error-fg)",
    infoBackground: "var(--status-info-bg)",
    infoForeground: "var(--status-info-fg)",
  },
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

export const radius = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export const fontSize = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.875rem", { lineHeight: "1.25rem" }],
  base: ["1rem", { lineHeight: "1.5rem" }],
  lg: ["1.125rem", { lineHeight: "1.75rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
} as const;

export const shadow = {
  card: "var(--shadow-card)",
  dialog: "var(--shadow-dialog)",
} as const;

export const motion = {
  duration: { fast: "150ms", base: "200ms", slow: "300ms" },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;
