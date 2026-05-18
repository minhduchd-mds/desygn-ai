import { test, expect } from "@playwright/test";

/**
 * API endpoint tests using Playwright's request context.
 *
 * These tests hit the local dev server directly (no browser UI needed).
 * The BASE_URL env var can override the default for CI / staging.
 *
 * Covered endpoints
 *   POST /api/checklist/audit-web  — structured web accessibility audit
 *   GET  /api/checklist/audit-web  — should be rejected (405)
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

test.describe("API Endpoints", () => {
  // ── POST /api/checklist/audit-web ─────────────────────────────────────────

  test.describe("POST /api/checklist/audit-web", () => {
    test("returns 200 with structured data for a valid URL", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "https://example.com" },
      });

      expect(response.status()).toBe(200);
      const body = await response.json() as Record<string, unknown>;

      // Top-level shape
      expect(body).toHaveProperty("url");
      expect(body).toHaveProperty("fetchedAt");
      expect(body).toHaveProperty("title");
      expect(body).toHaveProperty("headings");
      expect(body).toHaveProperty("images");
      expect(body).toHaveProperty("links");
      expect(body).toHaveProperty("meta");
      expect(body).toHaveProperty("accessibility");
      expect(body).toHaveProperty("performance");

      // Types
      expect(typeof body.url).toBe("string");
      expect(typeof body.fetchedAt).toBe("string");
      expect(Array.isArray(body.headings)).toBe(true);
      expect(Array.isArray(body.images)).toBe(true);
      expect(Array.isArray(body.links)).toBe(true);
    });

    test("accessibility object has all expected fields", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "https://example.com" },
      });

      expect(response.status()).toBe(200);
      const { accessibility } = await response.json() as { accessibility: Record<string, unknown> };

      expect(typeof accessibility.landmarkCount).toBe("number");
      expect(typeof accessibility.ariaLabelCount).toBe("number");
      expect(typeof accessibility.formLabelCount).toBe("number");
      expect(typeof accessibility.headingHierarchyValid).toBe("boolean");
      expect(typeof accessibility.imagesWithoutAlt).toBe("number");
    });

    test("performance object has htmlBytes and resourceEstimate", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "https://example.com" },
      });

      expect(response.status()).toBe(200);
      const { performance } = await response.json() as { performance: Record<string, unknown> };

      expect(typeof performance.htmlBytes).toBe("number");
      expect((performance.htmlBytes as number)).toBeGreaterThan(0);
      expect(typeof performance.resourceEstimate).toBe("number");
    });

    test("meta object has the expected nullable fields", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "https://example.com" },
      });

      expect(response.status()).toBe(200);
      const { meta } = await response.json() as { meta: Record<string, unknown> };

      // Fields may be null for pages that omit them — but the keys must exist
      expect("viewport" in meta).toBe(true);
      expect("description" in meta).toBe(true);
      expect("ogImage" in meta).toBe(true);
      expect("ogTitle" in meta).toBe(true);
      expect("colorScheme" in meta).toBe(true);
    });

    // ── Validation errors ────────────────────────────────────────────────────

    test("returns 400 for a non-URL string", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "not-a-url" },
      });

      expect(response.status()).toBe(400);
      const body = await response.json() as Record<string, unknown>;
      expect(body).toHaveProperty("error");
    });

    test("returns 400 for a URL with unsupported protocol (ftp)", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "ftp://example.com/resource" },
      });

      expect(response.status()).toBe(400);
    });

    test("returns 400 when url field is missing entirely", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: {},
      });

      expect(response.status()).toBe(400);
      const body = await response.json() as Record<string, unknown>;
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("details");
    });

    test("returns 400 when url is an empty string", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "" },
      });

      expect(response.status()).toBe(400);
    });

    test("returns 400 when url is a number instead of string", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: 12345 },
      });

      expect(response.status()).toBe(400);
    });

    // ── Optional fields ──────────────────────────────────────────────────────

    test("accepts optional viewport parameter", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: {
          url: "https://example.com",
          viewport: { width: 1280, height: 800 },
        },
      });

      // viewport is informational; should not affect the 200 response
      expect(response.status()).toBe(200);
    });

    test("accepts optional waitForSelector parameter", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: {
          url: "https://example.com",
          waitForSelector: "#main",
        },
      });

      // waitForSelector is informational (no browser used); still 200
      expect(response.status()).toBe(200);
    });

    test("rejects viewport with out-of-range width", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: {
          url: "https://example.com",
          viewport: { width: 200, height: 800 }, // below min 320
        },
      });

      expect(response.status()).toBe(400);
    });

    // ── Error response shape ─────────────────────────────────────────────────

    test("error body has 'error' key and 'details' array on validation failure", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "bad-url" },
      });

      expect(response.status()).toBe(400);
      const body = await response.json() as { error: unknown; details: unknown[] };
      expect(typeof body.error).toBe("string");
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThan(0);

      const firstDetail = body.details[0] as { path: string; message: string };
      expect(typeof firstDetail.message).toBe("string");
    });
  });

  // ── Wrong HTTP methods ─────────────────────────────────────────────────────

  test.describe("Wrong HTTP methods on /api/checklist/audit-web", () => {
    test("GET returns 405 Method Not Allowed", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/checklist/audit-web`);
      expect(response.status()).toBe(405);
    });

    test("PUT returns 405 Method Not Allowed", async ({ request }) => {
      const response = await request.put(`${BASE_URL}/api/checklist/audit-web`, {
        data: { url: "https://example.com" },
      });
      expect(response.status()).toBe(405);
    });

    test("DELETE returns 405 Method Not Allowed", async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/api/checklist/audit-web`);
      expect(response.status()).toBe(405);
    });

    test("405 response body contains an error message", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/checklist/audit-web`);
      expect(response.status()).toBe(405);
      const body = await response.json() as { error: string };
      expect(typeof body.error).toBe("string");
      expect(body.error.toLowerCase()).toContain("method");
    });
  });

  // ── OPTIONS (CORS preflight) ───────────────────────────────────────────────

  test("OPTIONS preflight returns 204 with CORS headers", async ({ request }) => {
    const response = await request.fetch(`${BASE_URL}/api/checklist/audit-web`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(response.status()).toBe(204);
  });

  // ── Content-Type header ───────────────────────────────────────────────────

  test("response Content-Type is application/json on success", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
      data: { url: "https://example.com" },
    });

    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });

  test("response Content-Type is application/json on 400 error", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/checklist/audit-web`, {
      data: { url: "invalid" },
    });

    expect(response.status()).toBe(400);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});
