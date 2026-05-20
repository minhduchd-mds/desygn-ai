/**
 * i18n types — locale union + the exhaustive translation-key union.
 *
 * Every user-facing string in the app has a stable key here. The `vi` and
 * `en` dictionaries are typed as `Record<TranslationKey, string>`, so adding
 * a key forces both locales to provide a value (compile-time completeness).
 */

export type Locale = "vi" | "en";

export const DEFAULT_LOCALE: Locale = "vi";
export const FALLBACK_LOCALE: Locale = "en";

/** localStorage key used to persist the active locale. */
export const LOCALE_STORAGE_KEY = "desygn-a11y.locale";

/** Union of every translatable string key rendered by the dashboard. */
export type TranslationKey =
  | "app.title"
  | "app.badge"
  | "app.tagline"
  | "card.title"
  | "card.body"
  | "button.startAudit"
  | "button.viewSample"
  | "status.line"
  | "lang.toggleLabel"
  | "lang.vi"
  | "lang.en"
  // Navigation (sidebar)
  | "nav.dashboard"
  | "nav.audits"
  | "nav.settings"
  | "nav.primaryLabel"
  // Top bar / shell
  | "shell.brand"
  | "shell.signOut"
  | "shell.userMenuLabel"
  // Auth — shared
  | "auth.emailLabel"
  | "auth.emailPlaceholder"
  | "auth.passwordLabel"
  | "auth.passwordPlaceholder"
  | "auth.backendUnconfiguredTitle"
  | "auth.backendUnconfiguredBody"
  | "auth.backendUnconfiguredCta"
  | "auth.genericError"
  // Auth — login
  | "auth.login.title"
  | "auth.login.submit"
  | "auth.login.submitting"
  | "auth.login.toSignupPrompt"
  | "auth.login.toSignupLink"
  // Auth — signup
  | "auth.signup.title"
  | "auth.signup.submit"
  | "auth.signup.submitting"
  | "auth.signup.success"
  | "auth.signup.toLoginPrompt"
  | "auth.signup.toLoginLink"
  // Audits page (placeholder)
  | "audits.title"
  | "audits.body"
  | "audits.cta"
  // Settings page (placeholder)
  | "settings.title"
  | "settings.body"
  | "settings.languageHeading"
  // Audit feature — score gauge
  | "audit.gauge.label"
  // Audit feature — severity labels
  | "audit.severity.critical"
  | "audit.severity.serious"
  | "audit.severity.moderate"
  | "audit.severity.minor"
  // Audit feature — issue list
  | "audit.issues.heading"
  | "audit.issues.empty"
  | "audit.issues.wcag"
  | "audit.issues.node"
  // Audit feature — start form
  | "audit.form.title"
  | "audit.form.urlLabel"
  | "audit.form.urlPlaceholder"
  | "audit.form.tokenLabel"
  | "audit.form.tokenPlaceholder"
  | "audit.form.versionLabel"
  | "audit.form.levelLabel"
  | "audit.form.submit"
  | "audit.form.submitting"
  | "audit.form.invalidUrl"
  | "audit.form.requestFailed"
  | "audit.form.successHeading"
  | "audit.form.scoreLabel"
  | "audit.form.issuesLabel"
  // Audit feature — list/table
  | "audit.list.heading"
  | "audit.list.colScore"
  | "audit.list.colSource"
  | "audit.list.colIssues"
  | "audit.list.colDate"
  | "audit.list.empty"
  | "audit.list.emptyHint";

/** A complete dictionary: one string per translation key. */
export type Dictionary = Record<TranslationKey, string>;
