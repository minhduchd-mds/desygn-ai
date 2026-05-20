/**
 * variants — Pure className builders for UI primitives.
 *
 * Styling lives in `primitives.css` (shipped + imported once by the app).
 * Components are thin wrappers that apply these class strings, keeping the
 * style logic pure and unit-testable in a node environment (no jsdom).
 *
 * Naming: BEM-ish with a `dsg-` (Desygn) prefix.
 */

import { cn } from "../lib/cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cn("dsg-btn", `dsg-btn--${variant}`, `dsg-btn--${size}`, extra);
}

export type InputState = "default" | "error";

export function inputClass(state: InputState = "default", extra?: string): string {
  return cn("dsg-input", state === "error" && "dsg-input--error", extra);
}

export type CardVariant = "default" | "elevated" | "outlined";

export function cardClass(variant: CardVariant = "default", extra?: string): string {
  return cn("dsg-card", `dsg-card--${variant}`, extra);
}

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

export function badgeClass(tone: BadgeTone = "neutral", extra?: string): string {
  return cn("dsg-badge", `dsg-badge--${tone}`, extra);
}

export type SpinnerSize = "sm" | "md" | "lg";

export function spinnerClass(size: SpinnerSize = "md", extra?: string): string {
  return cn("dsg-spinner", `dsg-spinner--${size}`, extra);
}

export function checkboxClass(extra?: string): string {
  return cn("dsg-checkbox", extra);
}

export function switchClass(checked = false, extra?: string): string {
  return cn("dsg-switch", checked && "dsg-switch--on", extra);
}

export type AvatarSize = "sm" | "md" | "lg";

export function avatarClass(size: AvatarSize = "md", extra?: string): string {
  return cn("dsg-avatar", `dsg-avatar--${size}`, extra);
}

/** Derive up-to-2-character initials from a name for the Avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map audit severity → badge tone, for reuse across the dashboard. */
export function severityToTone(severity: "critical" | "serious" | "moderate" | "minor"): BadgeTone {
  switch (severity) {
    case "critical":
      return "error";
    case "serious":
      return "warning";
    case "moderate":
      return "info";
    case "minor":
      return "neutral";
  }
}
