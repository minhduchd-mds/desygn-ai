# @desygn/figma-rest-adapter

Server-side Figma REST API client + transformer. Fetches a Figma file and
converts it into the `AuditNode[]` shape consumed by
[`@desygn/audit-engine`](../audit-engine).

## Install

```bash
npm install @desygn/figma-rest-adapter
```

## Usage

```ts
import {
  FigmaRestClient,
  transformFigmaToAuditNodes,
  parseFigmaUrl,
  LruCache,
} from "@desygn/figma-rest-adapter";

const { fileKey, nodeId } = parseFigmaUrl("https://figma.com/design/abc123/My-App?node-id=1-2");

const client = new FigmaRestClient(figmaToken, new LruCache(100, 300));
const file = await client.getFile(fileKey, nodeId ? [nodeId] : undefined);

const nodes = transformFigmaToAuditNodes(file.document);
// → feed `nodes` into createDefaultEngine().run({ nodes, options })
```

## What the transformer computes

- **contrastRatio** — real WCAG ratio of each TEXT node's fill against the
  nearest solid ancestor background
- **hasInteractions** — from the node's prototype `reactions` (ON_CLICK,
  ON_PRESS, …), falling back to layer-name keywords
- **hasMotion** — from animated reaction transitions (SMART_ANIMATE, PUSH, …)
- **headingLevel** — from layer name (`H1`…`H6`) or font-size brackets
- **fontSize / fontWeight** — for large-text contrast thresholds
- **touchTargetCompliant** — min dimension ≥ 24px

## Caching

`LruCache(maxEntries, ttlSeconds)` — in-memory, TTL + LRU eviction. Swap
for an Upstash Redis adapter in multi-instance deployments.

## License

MIT
