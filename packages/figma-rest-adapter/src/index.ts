/**
 * @desygn/figma-rest-adapter — Server-side Figma REST API client.
 *
 * Fetches Figma files via REST API (https://api.figma.com/v1) and
 * transforms responses into the AuditNode shape consumed by the
 * audit-engine package.
 *
 * Includes an in-memory LRU cache to avoid re-fetching the same file
 * within a short window (default 5 minutes).
 */

export { FigmaRestClient, FigmaApiError } from "./client.js";
export { transformFigmaToAuditNodes } from "./transformer.js";
export { LruCache } from "./cache.js";
export { parseFigmaUrl, type ParsedFigmaUrl } from "./url.js";
