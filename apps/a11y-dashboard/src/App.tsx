/**
 * App — Root component for Desygn A11y dashboard.
 *
 * Week 0 scaffold, now dogfooding @desygn/ui primitives to validate
 * cross-package consumption. Week 3 adds TanStack Router, auth shell,
 * and protected routes per 04-frontend-architecture.md.
 */

import { Button, Card, Badge } from "@desygn/ui";

export function App() {
  return (
    <main style={{ padding: "var(--space-8)", maxWidth: 720, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <h1 style={{ margin: 0 }}>Desygn A11y</h1>
        <Badge tone="info">Week 0</Badge>
      </header>

      <p style={{ color: "var(--color-slate-600)", marginTop: "var(--space-2)" }}>
        Accessibility-as-a-Service — Catch WCAG violations in Figma before they cost you
        $50,000 in lawsuits.
      </p>

      <Card variant="elevated" style={{ marginTop: "var(--space-6)" }}>
        <h2 style={{ marginTop: 0 }}>Run your first audit</h2>
        <p style={{ color: "var(--color-slate-600)" }}>
          Paste a Figma file URL and we'll check it against WCAG 2.2 AA.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          <Button variant="primary">Start audit</Button>
          <Button variant="ghost">View sample report</Button>
        </div>
      </Card>

      <p style={{ marginTop: "var(--space-6)", color: "var(--color-slate-500)" }}>
        Status: scaffold + design system wired. See{" "}
        <code>docs/architecture-v6/SCOPE_SUMMARY.md</code> for the full plan.
      </p>
    </main>
  );
}
