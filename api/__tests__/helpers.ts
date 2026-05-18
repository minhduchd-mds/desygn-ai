/**
 * Shared test helpers for API handler integration tests.
 *
 * Provides lightweight VercelRequest / VercelResponse mocks so that each
 * handler can be called directly without a running HTTP server.
 *
 * Note: @vercel/node is not installed as a package in this repo — only used
 * as `import type` in the api source files (types are erased at runtime).
 * These helpers use `unknown` casts so they have zero extra type dependencies.
 */

// ---------------------------------------------------------------------------
// Lightweight shape types (mirrors @vercel/node interfaces we actually use)
// ---------------------------------------------------------------------------

export interface MockReq {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface MockRes {
  _status: number;
  _json: unknown;
  _headers: Record<string, string>;
  status(code: number): MockRes;
  json(data: unknown): MockRes;
  setHeader(key: string, value: string): MockRes;
  end(): MockRes;
}

// ---------------------------------------------------------------------------
// Mock request factory
// ---------------------------------------------------------------------------

export function createMockReq(overrides: Partial<MockReq> = {}): MockReq & Record<string, unknown> {
  return {
    method: "POST",
    headers: {},
    body: {},
    ...overrides,
  } as MockReq & Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mock response factory
// ---------------------------------------------------------------------------

export function createMockRes(): MockRes {
  const res: MockRes = {
    _status: 200,
    _json: null,
    _headers: {},

    status(code: number) {
      res._status = code;
      return res;
    },

    json(data: unknown) {
      res._json = data;
      return res;
    },

    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },

    end() {
      return res;
    },
  };

  return res;
}

// ---------------------------------------------------------------------------
// Minimal valid ChecklistIssue body (used across github-issues tests)
// ---------------------------------------------------------------------------

export const VALID_ISSUE_BODY = {
  repo: "owner/repo",
  checkId: "ux-001",
  category: "Accessibility",
  criterion: "All images must have alt text",
  severity: "high" as const,
  confidence: 0.95,
  expected: "Every <img> has a descriptive alt attribute",
  observed: "3 images are missing alt text on the homepage",
  evidence: {
    source: "automated-scan",
    page: "/",
    selector: "img:not([alt])",
  },
  fixSuggestion: "Add alt attributes to the affected images",
  acceptanceCriteria: [
    "All img elements have non-empty alt attributes",
    "axe-core reports zero alt-text violations",
  ],
};
