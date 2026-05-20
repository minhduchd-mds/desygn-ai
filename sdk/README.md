# @desygn/sdk

Public SDK for building plugins and integrations on top of [Desygn AI](https://github.com/minhduchd-mds/desygn-ai).

> Status: **Experimental (v0.1.0)** — API is not yet stable. Pin exact versions.

## Install

```bash
npm install @desygn/sdk zod
```

## Quick start

```ts
import { defineCriterion, defineCheck, definePlugin } from "@desygn/sdk";

const myCriterion = defineCriterion({
  id: "myorg.button-min-size",
  name: "Buttons must be at least 44x44",
  description: "WCAG 2.5.5 — Touch targets",
  category: "accessibility",
  severity: "high",
  source: "custom",
  tags: ["a11y", "touch-target"],
});

const myCheck = defineCheck({
  criterionId: "myorg.button-min-size",
  check: (designContext) => {
    // your audit logic here
    return { checkId: "myorg.button-min-size", status: "pass", score: 1 };
  },
});

export default definePlugin({
  id: "myorg.a11y-pack",
  name: "My A11y Pack",
  version: "1.0.0",
  description: "Custom a11y rules for MyOrg designs",
  author: "MyOrg",
  contributes: { criteria: [myCriterion], checks: [myCheck] },
});
```

## What you can build

| Type | API | Purpose |
|------|-----|---------|
| **Criterion** | `defineCriterion()` | Declare a new audit criterion |
| **Check** | `defineCheck()` | Pure function that evaluates a criterion |
| **Agent** | `defineAgent()` | LLM-powered audit agent |
| **Plugin** | `definePlugin()` | Bundle the above into a distributable manifest |

## Surface area

### Validation schemas (re-exported from `@desygn/shared`)

`DesignSourceSchema`, `DesignNodeSchema`, `DesignContextSchema`, `CheckSeveritySchema`, `CheckStatusSchema`, `ChecklistCriterionSchema`, `CheckResultSchema`, `EvidenceArtifactSchema`, `AuditRunSchema`, `GitHubLabelSchema`, `GitHubIssueInputSchema`, `GitHubIssueResponseSchema`, `GitHubPRInputSchema`

### RBAC

`GLOBAL_ROLE_SCOPES`, `PROJECT_ROLE_SCOPES`, `checkPermission()`, `hasScope()`, `hasAllScopes()`, `hasAnyScope()`, `combineScopes()`

### Utilities

`sanitize()` — Strip prompt-injection attempts from untrusted text
`jsonSchemaToZod()` — Runtime JSON Schema → Zod schema conversion

## Examples

See [`sdk/examples/`](./examples) for working plugins:

- [`acme-brand-checker.ts`](./examples/acme-brand-checker.ts) — Brand audit (spacing scale, color palette, LLM tone reviewer)

## Compatibility

| SDK version | Desygn AI host |
|---|---|
| 0.1.x | >=5.0.0 |

## License

MIT — same as the host project.
