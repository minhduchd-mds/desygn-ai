/**
 * App — Root component for Desygn A11y marketing site.
 *
 * Week 0 scaffold: hero placeholder. Week 11 builds full landing
 * (hero, features, pricing, FAQ) per 07 roadmap.
 */

export function App() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 2rem" }}>
      <header style={{ marginBottom: "3rem" }}>
        <span style={{ fontSize: "0.875rem", color: "#7c3aed", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Accessibility-as-a-Service
        </span>
        <h1 style={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1.1, marginTop: "0.5rem" }}>
          Catch WCAG violations <br />
          <span style={{ color: "#7c3aed" }}>10× cheaper</span>, in Figma.
        </h1>
        <p style={{ fontSize: "1.25rem", color: "#475569", marginTop: "1rem", maxWidth: 640 }}>
          The only accessibility platform that audits your design before you write a single line of code.
        </p>
      </header>

      <p style={{ marginTop: "2rem", padding: "1rem", background: "#fef3c7", borderRadius: 8 }}>
        🚧 Week 0 scaffold. Full landing page built in Week 11 per implementation roadmap.
      </p>
    </main>
  );
}
