/**
 * Integration tests for POST /api/github/sync-webhook
 *
 * The handler is wrapped with withRateLimit (pass-through without Redis).
 * Signature verification uses GITHUB_WEBHOOK_SECRET; we set/unset it per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import handler from "../github/sync-webhook";
import { createMockReq, createMockRes } from "./helpers";

// ---------------------------------------------------------------------------
// Signature helper — mirrors what GitHub itself sends
// ---------------------------------------------------------------------------

function sign(payload: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${digest}`;
}

// ---------------------------------------------------------------------------
// Minimal valid event payloads
// ---------------------------------------------------------------------------

const ISSUES_PAYLOAD = {
  action: "opened",
  issue: {
    number: 1,
    title: "Test issue",
    html_url: "https://github.com/owner/repo/issues/1",
    state: "open",
  },
  repository: { full_name: "owner/repo" },
};

const PING_PAYLOAD = {
  zen: "Practicality beats purity.",
  hook_id: 123,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/github/sync-webhook", () => {
  const ORIGINAL_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

  beforeEach(() => {
    // Start each test without a secret (graceful degradation mode)
    delete process.env.GITHUB_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_SECRET !== undefined) {
      process.env.GITHUB_WEBHOOK_SECRET = ORIGINAL_SECRET;
    } else {
      delete process.env.GITHUB_WEBHOOK_SECRET;
    }
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 405 — wrong HTTP method
  // -------------------------------------------------------------------------

  it("returns 405 for non-POST methods", async () => {
    const req = createMockReq({ method: "GET", body: undefined });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect((res._json as { error: string }).error).toMatch(/method not allowed/i);
  });

  it("returns 405 for DELETE request", async () => {
    const req = createMockReq({ method: "DELETE", body: undefined });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
  });

  // -------------------------------------------------------------------------
  // 200 — ping event (no secret configured)
  // -------------------------------------------------------------------------

  it("returns 200 for a ping event when no secret is configured", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "x-github-event": "ping" },
      body: PING_PAYLOAD,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect((res._json as { received: boolean }).received).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 200 — issues event (no secret configured)
  // -------------------------------------------------------------------------

  it("returns 200 for a valid issues event when no secret is configured", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "x-github-event": "issues" },
      body: ISSUES_PAYLOAD,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect((res._json as { received: boolean }).received).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 200 — unknown event type is tolerated
  // -------------------------------------------------------------------------

  it("returns 200 for an unhandled event type (graceful fallthrough)", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "x-github-event": "star" },
      body: { action: "created", repository: { full_name: "owner/repo" } },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect((res._json as { received: boolean }).received).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Signature verification — skipped when no secret
  // -------------------------------------------------------------------------

  it("skips signature verification and returns 200 when GITHUB_WEBHOOK_SECRET is not set", async () => {
    // Provide a completely wrong signature — should still pass because no secret
    const req = createMockReq({
      method: "POST",
      headers: {
        "x-github-event": "ping",
        "x-hub-signature-256": "sha256=invalidsignature",
      },
      body: PING_PAYLOAD,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 401 — invalid signature when secret IS configured
  // -------------------------------------------------------------------------

  it("returns 401 when the signature is wrong and a secret is configured", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "correct-secret";

    const rawBody = JSON.stringify(ISSUES_PAYLOAD);
    const wrongSig = sign(rawBody, "wrong-secret");

    const req = createMockReq({
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": wrongSig,
      },
      body: ISSUES_PAYLOAD,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect((res._json as { error: string }).error).toMatch(/signature/i);
  });

  it("returns 401 when the signature header is missing and a secret is configured", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "some-secret";

    const req = createMockReq({
      method: "POST",
      headers: { "x-github-event": "issues" },
      // no x-hub-signature-256
      body: ISSUES_PAYLOAD,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 200 — valid signature when secret IS configured
  // -------------------------------------------------------------------------

  it("returns 200 when the signature matches and a secret is configured", async () => {
    const secret = "my-webhook-secret";
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    // The handler stringifies req.body when it isn't already a string
    const rawBody = JSON.stringify(ISSUES_PAYLOAD);
    const validSig = sign(rawBody, secret);

    const req = createMockReq({
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": validSig,
      },
      body: ISSUES_PAYLOAD,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect((res._json as { received: boolean }).received).toBe(true);
  });
});
