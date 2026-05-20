/**
 * English (en) dictionary — secondary locale and fallback.
 */

import type { Dictionary } from "./types.js";

export const en: Dictionary = {
  "app.title": "Desygn A11y",
  "app.badge": "Week 0",
  "app.tagline":
    "Accessibility-as-a-Service — Catch WCAG violations in Figma before they cost you $50,000 in lawsuits.",
  "card.title": "Run your first audit",
  "card.body": "Paste a Figma file URL and we'll check it against WCAG 2.2 AA.",
  "button.startAudit": "Start audit",
  "button.viewSample": "View sample report",
  "status.line": "Status: scaffold + design system wired.",
  "lang.toggleLabel": "Language",
  "lang.vi": "Vietnamese",
  "lang.en": "English",

  // Navigation (sidebar)
  "nav.dashboard": "Dashboard",
  "nav.audits": "Audits",
  "nav.settings": "Settings",
  "nav.primaryLabel": "Primary",

  // Top bar / shell
  "shell.brand": "Desygn A11y",
  "shell.signOut": "Sign out",
  "shell.userMenuLabel": "Account",

  // Auth — shared
  "auth.emailLabel": "Email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Password",
  "auth.passwordPlaceholder": "Enter your password",
  "auth.backendUnconfiguredTitle": "Backend not configured",
  "auth.backendUnconfiguredBody":
    "Authentication is unavailable because Supabase is not set up. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload.",
  "auth.backendUnconfiguredCta": "Sign in (disabled)",
  "auth.genericError": "Something went wrong. Please try again.",

  // Auth — login
  "auth.login.title": "Sign in",
  "auth.login.submit": "Sign in",
  "auth.login.submitting": "Signing in…",
  "auth.login.toSignupPrompt": "Don't have an account?",
  "auth.login.toSignupLink": "Sign up",

  // Auth — signup
  "auth.signup.title": "Create account",
  "auth.signup.submit": "Sign up",
  "auth.signup.submitting": "Creating account…",
  "auth.signup.success": "Account created. Check your email to confirm sign-in.",
  "auth.signup.toLoginPrompt": "Already have an account?",
  "auth.signup.toLoginLink": "Sign in",

  // Audits page (placeholder)
  "audits.title": "Audits",
  "audits.body": "Your accessibility audits will appear here.",
  "audits.cta": "Start a new audit",

  // Settings page (placeholder)
  "settings.title": "Settings",
  "settings.body": "Manage your workspace preferences.",
  "settings.languageHeading": "Language",

  // Audit feature — score gauge
  "audit.gauge.label": "Accessibility score: {score} out of 100",

  // Audit feature — severity labels
  "audit.severity.critical": "Critical",
  "audit.severity.serious": "Serious",
  "audit.severity.moderate": "Moderate",
  "audit.severity.minor": "Minor",

  // Audit feature — issue list
  "audit.issues.heading": "Issues",
  "audit.issues.empty": "No issues found. Nice work!",
  "audit.issues.wcag": "WCAG criterion",
  "audit.issues.node": "Node",

  // Audit feature — start form
  "audit.form.title": "New audit",
  "audit.form.urlLabel": "Figma file URL",
  "audit.form.urlPlaceholder": "https://www.figma.com/design/…",
  "audit.form.tokenLabel": "Figma access token",
  "audit.form.tokenPlaceholder": "figd_…",
  "audit.form.versionLabel": "WCAG version",
  "audit.form.levelLabel": "WCAG level",
  "audit.form.submit": "Start audit",
  "audit.form.submitting": "Auditing…",
  "audit.form.invalidUrl": "Please enter a valid Figma file URL.",
  "audit.form.requestFailed":
    "Could not start the audit. Check your connection and try again.",
  "audit.form.successHeading": "Audit complete",
  "audit.form.scoreLabel": "Score",
  "audit.form.issuesLabel": "Total issues",

  // Audit feature — list/table
  "audit.list.heading": "Recent audits",
  "audit.list.colScore": "Score",
  "audit.list.colSource": "Source",
  "audit.list.colIssues": "Issues",
  "audit.list.colDate": "Date",
  "audit.list.empty": "No audits yet.",
  "audit.list.emptyHint": "Start your first audit to see results here.",
};
