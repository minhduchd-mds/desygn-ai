/**
 * App — Root component for Desygn A11y dashboard.
 *
 * Week 0 scaffold: minimal placeholder. Week 3 adds TanStack Router,
 * auth shell, and protected routes per 04-frontend-architecture.md.
 */

export function App() {
  return (
    <main style={{ padding: "var(--space-8, 2rem)", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-4, 1rem)" }}>Desygn A11y</h1>
      <p style={{ color: "var(--color-slate-600, #475569)" }}>
        Accessibility-as-a-Service — Catch WCAG violations in Figma before they cost you $50,000 in lawsuits.
      </p>
      <p style={{ marginTop: "var(--space-4, 1rem)" }}>
        <strong>Status:</strong> Week 0 scaffold. Awaiting owner approval to begin Week 1.
      </p>
      <p style={{ marginTop: "var(--space-2, 0.5rem)" }}>
        See <code>docs/architecture-v6/SCOPE_SUMMARY.md</code> for full plan.
      </p>
    </main>
  );
}
