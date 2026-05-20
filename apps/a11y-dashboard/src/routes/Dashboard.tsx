/**
 * Dashboard — the authenticated home page (formerly App.tsx's content).
 *
 * Rendered inside <AppShell>, which supplies the single <main> landmark and
 * the language toggle. This page therefore renders ONLY its <h1> + content
 * (no <main>, no toggle) to keep exactly one <main> / one <h1> per route for
 * the e2e structural checks.
 */

import { Button, Card, Badge } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { AuditScoreGauge } from "../features/audit/index.js";

export function Dashboard() {
  const { t } = useTranslation();

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <h1 style={{ margin: 0 }}>{t("app.title")}</h1>
        <Badge tone="info">{t("app.badge")}</Badge>
      </header>

      <p style={{ color: "var(--color-slate-600)", marginTop: "var(--space-2)" }}>
        {t("app.tagline")}
      </p>

      <Card variant="elevated" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "center", flexWrap: "wrap" }}>
          <AuditScoreGauge score={87} />
          <div>
            <h2 style={{ marginTop: 0 }}>{t("card.title")}</h2>
            <p style={{ color: "var(--color-slate-600)" }}>{t("card.body")}</p>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <Button variant="primary">{t("button.startAudit")}</Button>
              <Button variant="ghost">{t("button.viewSample")}</Button>
            </div>
          </div>
        </div>
      </Card>

      <p style={{ marginTop: "var(--space-6)", color: "var(--color-slate-500)" }}>
        {t("status.line")}
      </p>
    </>
  );
}
