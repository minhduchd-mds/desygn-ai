/**
 * POST /api/checklist/audit-web
 *
 * Lightweight web auditor — fetches a target URL, parses the HTML with
 * Node.js built-ins (no browser / Playwright required) and returns
 * structured accessibility + structural data that the Agentic UI/UX
 * Auditor can consume directly.
 *
 * Rate limit: 10 req / 60 s per IP  (Upstash Redis sliding-window)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { withRateLimit } from "../lib/rate-limit";
import { getAllowedOrigin, setCorsHeaders } from "../lib/cors";

// ---------------------------------------------------------------------------
// Zod input schema
// ---------------------------------------------------------------------------

const RequestBodySchema = z.object({
  url: z
    .string()
    .url("url must be a valid absolute URL")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      "url must use http or https protocol"
    ),
  viewport: z
    .object({
      width: z.number().int().min(320).max(3840),
      height: z.number().int().min(240).max(2160),
    })
    .optional(),
  waitForSelector: z.string().optional(), // informational only — no browser used
});

type RequestBody = z.infer<typeof RequestBodySchema>;

// ---------------------------------------------------------------------------
// HTML extraction helpers
// ---------------------------------------------------------------------------

/** Simple regex-based attribute extractor — avoids a full DOM parser dep. */
function attr(tag: string, name: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*?)"|'([^']*?)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
}

/** Extract all tags matching a simple selector (tag name only). */
function* matchTags(html: string, tagName: string): Generator<string> {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>(?:[^<]*<\\/${tagName}>)?`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    yield m[0];
  }
}

/** Extract inner text from a tag string (strips child tags). */
function innerText(tag: string): string {
  return tag.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Extraction logic
// ---------------------------------------------------------------------------

interface HeadingEntry {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

interface ImageEntry {
  src: string;
  alt: string;
  /** null when no explicit width/height attributes */
  width: number | null;
  height: number | null;
}

interface LinkEntry {
  href: string;
  text: string;
  isExternal: boolean;
}

interface MetaInfo {
  viewport: string | null;
  description: string | null;
  ogImage: string | null;
  ogTitle: string | null;
  colorScheme: string | null;
}

interface AccessibilityInfo {
  lang: string | null;
  /** Count of elements carrying a role="landmark" (main, nav, header, footer, etc.) */
  landmarkCount: number;
  ariaLabelCount: number;
  formLabelCount: number;
  /** headings in correct nesting order (no skipped levels) */
  headingHierarchyValid: boolean;
  imagesWithoutAlt: number;
}

interface PerformanceInfo {
  htmlBytes: number;
  /** Rough count of external resource hints (link/script/img tags) */
  resourceEstimate: number;
}

interface AuditResult {
  url: string;
  fetchedAt: string;
  title: string;
  headings: HeadingEntry[];
  images: ImageEntry[];
  links: LinkEntry[];
  meta: MetaInfo;
  accessibility: AccessibilityInfo;
  performance: PerformanceInfo;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? innerText(m[0]) : "";
}

function extractHeadings(html: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const re = /<h([1-6])(?:\s[^>]*)?>[\s\S]*?<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    headings.push({
      level: Number(m[1]) as HeadingEntry["level"],
      text: innerText(m[0]).slice(0, 200),
    });
  }
  return headings;
}

function extractImages(html: string): ImageEntry[] {
  const images: ImageEntry[] = [];
  for (const tag of matchTags(html, "img")) {
    const src = attr(tag, "src");
    if (!src) continue;
    const widthRaw = attr(tag, "width");
    const heightRaw = attr(tag, "height");
    images.push({
      src: src.slice(0, 500),
      alt: attr(tag, "alt"),
      width: widthRaw ? Number(widthRaw) || null : null,
      height: heightRaw ? Number(heightRaw) || null : null,
    });
  }
  return images;
}

function extractLinks(html: string, baseUrl: string): LinkEntry[] {
  const baseHost = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return "";
    }
  })();

  const links: LinkEntry[] = [];
  for (const tag of matchTags(html, "a")) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    const text = innerText(tag).slice(0, 200);
    let isExternal = false;
    try {
      const u = new URL(href, baseUrl);
      isExternal = u.hostname !== baseHost;
    } catch {
      // relative URL — internal
    }
    links.push({ href: href.slice(0, 500), text, isExternal });
    if (links.length >= 100) break; // cap to avoid huge payloads
  }
  return links;
}

function extractMeta(html: string): MetaInfo {
  const meta: MetaInfo = {
    viewport: null,
    description: null,
    ogImage: null,
    ogTitle: null,
    colorScheme: null,
  };

  const metaRe = /<meta\s[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) {
    const tag = m[0];
    const name = (attr(tag, "name") || attr(tag, "property")).toLowerCase();
    const content = attr(tag, "content");

    if (name === "viewport") meta.viewport = content;
    else if (name === "description") meta.description = content.slice(0, 300);
    else if (name === "og:image") meta.ogImage = content.slice(0, 500);
    else if (name === "og:title") meta.ogTitle = content.slice(0, 200);
    else if (name === "color-scheme") meta.colorScheme = content;
  }
  return meta;
}

function extractAccessibility(
  html: string,
  headings: HeadingEntry[],
  images: ImageEntry[]
): AccessibilityInfo {
  // lang attribute on <html>
  const htmlTagMatch = html.match(/<html\s[^>]*>/i);
  const lang = htmlTagMatch ? attr(htmlTagMatch[0], "lang") || null : null;

  // Landmark roles: elements with role= or semantic landmark tags
  const landmarkRoles = ["main", "nav", "header", "footer", "aside", "section", "article"];
  let landmarkCount = 0;
  for (const role of landmarkRoles) {
    const tagRe = new RegExp(`<${role}[\\s>]`, "gi");
    const matches = html.match(tagRe);
    if (matches) landmarkCount += matches.length;
  }
  // Also count explicit role= attributes for landmark values
  const roleAttrRe = /role\s*=\s*["']?(main|navigation|banner|contentinfo|complementary|search|form|region)["']?/gi;
  const roleMatches = html.match(roleAttrRe);
  if (roleMatches) landmarkCount += roleMatches.length;

  // aria-label count
  const ariaLabelMatches = html.match(/aria-label\s*=/gi);
  const ariaLabelCount = ariaLabelMatches?.length ?? 0;

  // <label> elements
  const labelMatches = html.match(/<label[\s>]/gi);
  const formLabelCount = labelMatches?.length ?? 0;

  // Heading hierarchy check — no level should jump by more than 1
  let headingHierarchyValid = true;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) {
      headingHierarchyValid = false;
      break;
    }
  }

  const imagesWithoutAlt = images.filter(
    (img) => img.alt === "" || img.alt === undefined
  ).length;

  return {
    lang,
    landmarkCount,
    ariaLabelCount,
    formLabelCount,
    headingHierarchyValid,
    imagesWithoutAlt,
  };
}

function estimateResourceCount(html: string): number {
  let count = 0;
  const patterns = [
    /<script\s[^>]*src\s*=/gi,
    /<link\s[^>]*href\s*=/gi,
    /<img\s[^>]*src\s*=/gi,
    /<source\s[^>]*src\s*=/gi,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) count += m.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DesygnAI-Auditor/1.0; +https://designready.ai)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error(
        `Expected HTML but received content-type: ${contentType}`
      );
    }

    const html = await response.text();
    return { html, finalUrl: response.url ?? url };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 15_000;

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // --- CORS ---
  const origin = getAllowedOrigin(req);
  setCorsHeaders(res, origin);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  // --- Input validation ---
  const parsed = RequestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: (parsed.error.issues ?? []).map((e) => ({
        path: (e.path ?? []).join("."),
        message: e.message,
      })),
    });
    return;
  }

  const { url } = parsed.data as RequestBody;

  // --- Fetch target page ---
  let html: string;
  let finalUrl: string;

  try {
    ({ html, finalUrl } = await fetchWithTimeout(url, FETCH_TIMEOUT_MS));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("aborted") || message.includes("timed out")) {
      res.status(504).json({
        error: "Request timed out",
        message: `The target URL did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`,
        url,
      });
      return;
    }

    res.status(502).json({
      error: "Failed to fetch target URL",
      message,
      url,
    });
    return;
  }

  // --- Parse & extract ---
  const title = extractTitle(html);
  const headings = extractHeadings(html);
  const images = extractImages(html);
  const links = extractLinks(html, finalUrl);
  const meta = extractMeta(html);
  const accessibility = extractAccessibility(html, headings, images);
  const performance: PerformanceInfo = {
    htmlBytes: Buffer.byteLength(html, "utf8"),
    resourceEstimate: estimateResourceCount(html),
  };

  const result: AuditResult = {
    url: finalUrl,
    fetchedAt: new Date().toISOString(),
    title,
    headings,
    images,
    links,
    meta,
    accessibility,
    performance,
  };

  res.status(200).json(result);
}

// Wrap with Upstash Redis sliding-window rate limit: 10 req / 60 s per IP
export default withRateLimit(handler, "audit-web", 10);
