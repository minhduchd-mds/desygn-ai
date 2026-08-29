# Source provenance and clean implementation policy

Desygn AI uses external material to understand standards and APIs, but core product algorithms should be implemented independently in this repository.

## Rules

- Standards, research papers, official documentation, and public API specifications may be referenced.
- Third-party source code is not copied into core packages unless its license is explicitly compatible and required attribution is recorded.
- Algorithm work starts from a repository-owned specification, then tests, then implementation.
- Any adapted source must record upstream URL, commit/tag, license, copyright requirements, and modifications.
- Minified/vendor bundles must retain their upstream license notices and should preferably be installed as packages rather than committed as copied source.

## References used for vNext

| Reference | Purpose | Code copied? |
| --- | --- | --- |
| W3C WCAG 2.2 — https://www.w3.org/TR/WCAG22/ | Accessibility requirements and terminology | No |
| React 19.2 release notes — https://react.dev/blog/2025/10/01/react-19-2 | Current React capabilities and lifecycle guidance | No |
| Vite 8 announcement — https://vite.dev/blog/announcing-vite8 | Build/runtime architecture awareness | No |
| OpenTelemetry JS — https://opentelemetry.io/docs/languages/js/ | Observability interface concepts | No |

## Repository-owned algorithm

`packages/audit-engine/src/scoring.ts` implements an original accessibility risk score. It does **not** reproduce axe, Lighthouse, WAVE, or another vendor's scoring implementation.

The score uses the following repository-defined model:

1. severity base risk;
2. logarithmic saturation for repeated findings of the same rule/severity;
3. issue density relative to inspected nodes;
4. breadth across evaluated rules and categories;
5. explicit score ceilings when critical/systemic serious defects exist.

The algorithm is deterministic and its invariants are covered by `scoring.test.ts`.
