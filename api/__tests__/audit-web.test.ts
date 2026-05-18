/**
 * Integration tests for POST /api/checklist/audit-web
 *
 * The handler is wrapped with withRateLimit, which gracefully degrades
 * (allows all requests) when UPSTASH_REDIS_REST_URL / TOKEN are absent,
 * so the underlying handler is always reachable in a test environment.
 *
 * fetch is mocked globally so no real network requests are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../checklist/audit-web";
import { createMockReq, createMockRes } from "./helpers";

// ---------------------------------------------------------------------------
// Minimal HTML fixture
// ---------------------------------------------------------------------------

const MINIMAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Test page description" />
  <title>Test Page</title>
</head>
<body>
  <main>
    <h1>Hello World</h1>
    <h2>Section one</h2>
    <img src="/logo.png" alt="Logo" width="200" height="100" />
    <a href="/about">About us</a>
    <a href="https://external.example.com">External link</a>
  </main>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Helpers to build mock fetch responses
// ---------------------------------------------------------------------------

function mockHtmlResponse(html: string, url = "https://example.com/"): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    url,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null,
    },
    text: async () => html,
  } as unknown as Response;
}

function mockNonHtmlResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    url: "https://example.com/data.json",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    text: async () => '{"key":"value"}',
  } as unknown as Response;
}

function mockHttpErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    statusText: "Not Found",
    url: "https://example.com/missing",
    headers: { get: () => null },
    text: async () => "",
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/checklist/audit-web", () => {
  beforeEach(() => {
    // Reset any fetch mock between tests
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 405 — wrong HTTP method
  // -------------------------------------------------------------------------

  it("returns 405 for GET request", async () => {
    const req = createMockReq({ method: "GET", body: undefined });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect((res._json as { error: string }).error).toMatch(/method not allowed/i);
  });

  // -------------------------------------------------------------------------
  // 400 — missing URL
  // -------------------------------------------------------------------------

  it("returns 400 when url field is missing", async () => {
    const req = createMockReq({ method: "POST", body: {} });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    const json = res._json as { error: string; details: unknown[] };
    expect(json.error).toMatch(/invalid request body/i);
    expect(json.details).toBeInstanceOf(Array);
    expect(json.details.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 400 — invalid URL (not http/https)
  // -------------------------------------------------------------------------

  it("returns 400 for invalid URL (non-http scheme)", async () => {
    const req = createMockReq({
      method: "POST",
      body: { url: "ftp://example.com/page" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    const json = res._json as { error: string; details: { message: string }[] };
    expect(json.error).toMatch(/invalid request body/i);
    // The zod refine message references http/https
    const messages = json.details.map((d) => d.message).join(" ");
    expect(messages).toMatch(/http/i);
  });

  it("returns 400 for a plain string that is not a URL", async () => {
    const req = createMockReq({
      method: "POST",
      body: { url: "not-a-url-at-all" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect((res._json as { error: string }).error).toMatch(/invalid request body/i);
  });

  // -------------------------------------------------------------------------
  // 504 — fetch timeout
  // -------------------------------------------------------------------------

  it("returns 504 when the target URL times out (AbortError)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
    );

    const req = createMockReq({
      method: "POST",
      body: { url: "https://slow.example.com/" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(504);
    expect((res._json as { error: string }).error).toMatch(/timed out/i);
  });

  // -------------------------------------------------------------------------
  // 502 — non-HTML response
  // -------------------------------------------------------------------------

  it("returns 502 when the target returns a non-HTML content-type", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockNonHtmlResponse());

    const req = createMockReq({
      method: "POST",
      body: { url: "https://example.com/data.json" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(502);
    const json = res._json as { error: string; message: string };
    expect(json.error).toMatch(/failed to fetch/i);
    expect(json.message).toMatch(/content-type/i);
  });

  // -------------------------------------------------------------------------
  // 502 — upstream HTTP error
  // -------------------------------------------------------------------------

  it("returns 502 when the target URL responds with HTTP 404", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockHttpErrorResponse(404));

    const req = createMockReq({
      method: "POST",
      body: { url: "https://example.com/missing-page" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(502);
    expect((res._json as { error: string }).error).toMatch(/failed to fetch/i);
  });

  // -------------------------------------------------------------------------
  // 200 — successful HTML extraction
  // -------------------------------------------------------------------------

  it("extracts structured HTML data from a valid page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      mockHtmlResponse(MINIMAL_HTML, "https://example.com/")
    );

    const req = createMockReq({
      method: "POST",
      body: { url: "https://example.com/" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);

    const result = res._json as {
      url: string;
      fetchedAt: string;
      title: string;
      headings: { level: number; text: string }[];
      images: { src: string; alt: string }[];
      links: { href: string; isExternal: boolean }[];
      meta: { viewport: string | null; description: string | null };
      accessibility: { lang: string | null; headingHierarchyValid: boolean };
      performance: { htmlBytes: number; resourceEstimate: number };
    };

    expect(result.title).toBe("Test Page");
    expect(result.headings).toHaveLength(2);
    expect(result.headings[0]).toMatchObject({ level: 1, text: "Hello World" });
    expect(result.headings[1]).toMatchObject({ level: 2, text: "Section one" });

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({ src: "/logo.png", alt: "Logo" });

    // One internal link, one external
    const externalLinks = result.links.filter((l) => l.isExternal);
    expect(externalLinks).toHaveLength(1);

    expect(result.meta.viewport).toBeTruthy();
    expect(result.meta.description).toBe("Test page description");

    expect(result.accessibility.lang).toBe("en");
    expect(result.accessibility.headingHierarchyValid).toBe(true);

    expect(result.performance.htmlBytes).toBeGreaterThan(0);
    expect(typeof result.fetchedAt).toBe("string");
  });

  // -------------------------------------------------------------------------
  // 200 — optional viewport field is accepted
  // -------------------------------------------------------------------------

  it("accepts an optional viewport field alongside the URL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      mockHtmlResponse(MINIMAL_HTML)
    );

    const req = createMockReq({
      method: "POST",
      body: {
        url: "https://example.com/",
        viewport: { width: 1440, height: 900 },
      },
    });
    const res = createMockRes();

    await handler(req, res);

    // Viewport is informational — handler should still succeed
    expect(res._status).toBe(200);
    expect((res._json as { title: string }).title).toBe("Test Page");
  });
});
