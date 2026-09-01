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
| `davila7/claude-code-templates` — https://github.com/davila7/claude-code-templates, reviewed at upstream main commit `618365a60f59db76dd91693996dc6d5f5b1cd86d` | Structural inspiration for repo-local specialist agents, bounded custom commands, and component validation/security discipline | No; MIT source used as concept/format reference only |

## Repository-owned algorithm

`packages/audit-engine/src/scoring.ts` implements an original accessibility risk score. It does **not** reproduce axe, Lighthouse, WAVE, or another vendor's scoring implementation.

The score uses the following repository-defined model:

1. severity base risk;
2. logarithmic saturation for repeated findings of the same rule/severity;
3. issue density relative to inspected nodes;
4. breadth across evaluated rules and categories;
5. explicit score ceilings when critical/systemic serious defects exist.

The algorithm is deterministic and its invariants are covered by `scoring.test.ts`.

The repo-local agent files under `.claude/` are written specifically for Desygn AI's package/runtime/product constraints. No upstream template prompt body or implementation code was copied.
