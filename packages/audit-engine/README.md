# @desygn/audit-engine

WCAG accessibility audit engine for Desygn A11y. Pure functions — no
Figma API, no network, no side effects. Takes a normalized node tree and
returns a scored list of WCAG violations.

## Install

```bash
npm install @desygn/audit-engine
```

## Usage

```ts
import { createDefaultEngine } from "@desygn/audit-engine";

const engine = createDefaultEngine();

const result = await engine.run({
  nodes: [
    { id: "1", name: "Body", type: "TEXT", text: "Hello", contrastRatio: 3.1, fontSize: 14 },
  ],
  options: { wcagVersion: "2.2", wcagLevel: "AA" },
});

console.log(result.score);   // 0-100
console.log(result.summary); // { critical, serious, moderate, minor, total, byCategory }
console.log(result.issues);  // AuditIssue[]
```

## Rules (7)

| Rule id | WCAG | Category |
|---|---|---|
| `contrast.text` | 1.4.3 / 1.4.6 | contrast |
| `touch-target.size` | 2.5.8 / 2.5.5 | touch-target |
| `aria.accessible-name` | 1.3.1 / 4.1.2 | aria |
| `keyboard.focus-indicator` | 2.4.7 | keyboard |
| `heading.hierarchy` | 1.3.1 | heading |
| `motion.reduced-motion` | 2.3.3 | motion |
| `semantic.structure` | 1.3.1 | semantic |

Select a subset via `options.rules: ["contrast.text", ...]`.

## Color math

`color.ts` exposes the WCAG contrast primitives used by the contrast rule:

```ts
import { contrastRatio, contrastRatioHex, isLargeText, requiredContrast } from "@desygn/audit-engine";

contrastRatioHex("#767676", "#ffffff"); // ≈ 4.54
isLargeText(24, 400);                    // true (≥18pt)
requiredContrast("AA", false);           // 4.5
```

## Design

- Rules are pure `(input) => { issues }` functions, run in parallel
- Each rule is timeout-protected and error-isolated — one failing rule
  never breaks the audit
- Scoring: severity-weighted deductions (critical 10, serious 5,
  moderate 2, minor 0.5), clamped to 0-100
- Deterministic: same input → same output (cacheable)

## License

MIT
