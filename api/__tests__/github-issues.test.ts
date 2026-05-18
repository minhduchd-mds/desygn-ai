/**
 * Integration tests for POST /api/github/create-checklist-issues
 *
 * The handler is wrapped with withRateLimit (pass-through when Redis env
 * vars are absent).  fetch is mocked globally for GitHub API calls.
 * GITHUB_TOKEN is set in beforeEach so the token-guard doesn't block tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../github/create-checklist-issues";
import { createMockReq, createMockRes, VALID_ISSUE_BODY } from "./helpers";

// ---------------------------------------------------------------------------
// GitHub API response helpers
// ---------------------------------------------------------------------------

function mockGitHubSuccess(issueNumber = 42): Response {
  return {
    ok: true,
    status: 201,
    statusText: "Created",
    json: async () => ({
      number: issueNumber,
      html_url: `https://github.com/owner/repo/issues/${issueNumber}`,
    }),
    text: async () => "",
  } as unknown as Response;
}

function mockGitHubError(status: number, message = "Not Found"): Response {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () => ({ message }),
    text: async () => JSON.stringify({ message }),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/github/create-checklist-issues", () => {
  const ORIGINAL_GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    // Provide a fake token so the env-guard passes
    process.env.GITHUB_TOKEN = "ghp_fake_test_token";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = ORIGINAL_GITHUB_TOKEN;
    vi.restoreAllMocks();
    vi.useRealTimers();
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
  // 500 — missing GITHUB_TOKEN
  // -------------------------------------------------------------------------

  it("returns 500 when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;

    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer some-token" },
      body: VALID_ISSUE_BODY,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect((res._json as { error: string }).error).toMatch(/GITHUB_TOKEN/);
  });

  // -------------------------------------------------------------------------
  // 401 — missing auth header
  // -------------------------------------------------------------------------

  it("returns 401 when neither Authorization nor X-API-Key header is provided", async () => {
    const req = createMockReq({
      method: "POST",
      headers: {}, // no auth
      body: VALID_ISSUE_BODY,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect((res._json as { error: string }).error).toMatch(/unauthorized/i);
  });

  it("accepts X-API-Key header as valid auth", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockGitHubSuccess());

    const req = createMockReq({
      method: "POST",
      headers: { "x-api-key": "my-secret-key" },
      body: VALID_ISSUE_BODY,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 400 — invalid input
  // -------------------------------------------------------------------------

  it("returns 400 when required fields are missing", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: {
        // repo present but everything else missing
        repo: "owner/repo",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    const json = res._json as { error: string; details: { path: string; message: string }[] };
    expect(json.error).toMatch(/invalid request body/i);
    expect(json.details.length).toBeGreaterThan(0);
  });

  it("returns 400 when repo format is wrong (missing slash)", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: { ...VALID_ISSUE_BODY, repo: "just-a-name" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    const details = (res._json as { details: { message: string }[] }).details;
    const repoError = details.find((d) => d.message.includes("owner/repo"));
    expect(repoError).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 200 — successful issue creation
  // -------------------------------------------------------------------------

  it("creates a GitHub issue and returns its number + URL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockGitHubSuccess(99));

    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer Bearer-ghp_token" },
      body: VALID_ISSUE_BODY,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    const json = res._json as { results: { checkId: string; issueNumber: number; issueUrl: string; status: string }[] };
    expect(json.results).toHaveLength(1);
    expect(json.results[0].status).toBe("created");
    expect(json.results[0].issueNumber).toBe(99);
    expect(json.results[0].issueUrl).toContain("/issues/99");
    expect(json.results[0].checkId).toBe("ux-001");
  });

  it("accepts an array of issues and returns a result for each", async () => {
    vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockGitHubSuccess(10))
      .mockResolvedValueOnce(mockGitHubSuccess(11));

    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: [
        VALID_ISSUE_BODY,
        { ...VALID_ISSUE_BODY, checkId: "ux-002", severity: "medium" as const },
      ],
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    const json = res._json as { results: { checkId: string; status: string }[] };
    expect(json.results).toHaveLength(2);
    expect(json.results[0].checkId).toBe("ux-001");
    expect(json.results[1].checkId).toBe("ux-002");
    expect(json.results.every((r) => r.status === "created")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // GitHub API error — recorded per-issue, not a 500
  // -------------------------------------------------------------------------

  it("records a failed status per issue when GitHub API returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockGitHubError(422, "Validation Failed"));

    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: VALID_ISSUE_BODY,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200); // outer response is still 200
    const json = res._json as { results: { status: string; error: string; checkId: string }[] };
    expect(json.results[0].status).toBe("failed");
    expect(json.results[0].checkId).toBe("ux-001");
    expect(json.results[0].error).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Retry on 5xx — handler retries up to 2 times on GitHub server errors
  // -------------------------------------------------------------------------

  it("retries on GitHub 5xx and succeeds on the third attempt", async () => {
    // Use fake timers to avoid real delays from the exponential backoff
    vi.useFakeTimers();

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockGitHubError(503, "Service Unavailable"))
      .mockResolvedValueOnce(mockGitHubError(503, "Service Unavailable"))
      .mockResolvedValueOnce(mockGitHubSuccess(7));

    const req = createMockReq({
      method: "POST",
      headers: { authorization: "Bearer tok" },
      body: VALID_ISSUE_BODY,
    });
    const res = createMockRes();

    // Run handler + advance all pending timers concurrently
    const handlerPromise = handler(req, res);
    await vi.runAllTimersAsync();
    await handlerPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(res._status).toBe(200);
    const json = res._json as { results: { status: string; issueNumber: number }[] };
    expect(json.results[0].status).toBe("created");
    expect(json.results[0].issueNumber).toBe(7);
  });
});
