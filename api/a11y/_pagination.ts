/**
 * _pagination — Pure cursor helpers for the audit-list endpoint.
 *
 * The cursor is a base64url-encoded JSON object `{ t, i }` where:
 *   - `t` is the ISO timestamp of `audit_runs.created_at`
 *   - `i` is the `audit_runs.id` (uuid)
 *
 * Both fields together break ties on rows that share a `created_at` value,
 * which is the same `(created_at, id)` ordering used by the list query.
 *
 * `decodeCursor` is designed to never throw: malformed input (bad base64,
 * non-JSON, JSON with missing/typed-wrong fields) returns `null` so the
 * handler can return a tidy 400 instead of leaking a stack trace.
 *
 * Lives outside `_shared.ts` so a sibling agent can edit `_shared.ts` in
 * parallel without merge collisions.
 */

export interface AuditCursor {
  /** ISO timestamp of `audit_runs.created_at`. */
  t: string;
  /** `audit_runs.id` (uuid). */
  i: string;
}

/** base64 → base64url (URL-safe, no padding). */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → base64 (re-pad so atob/Buffer accepts it). */
function fromBase64Url(s: string): string {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  return normalized + "=".repeat(padLen);
}

/** Encode `{ t, i }` as a base64url-encoded JSON string. */
export function encodeCursor(cursor: AuditCursor): string {
  const json = JSON.stringify({ t: cursor.t, i: cursor.i });
  // Edge runtime + Node 18+ both expose btoa via globalThis.
  const b64 =
    typeof btoa === "function"
      ? btoa(json)
      : Buffer.from(json, "utf-8").toString("base64");
  return toBase64Url(b64);
}

/**
 * Decode a base64url cursor back into `{ t, i }`.
 * Returns `null` for any malformed input (never throws).
 */
export function decodeCursor(input: string): AuditCursor | null {
  if (typeof input !== "string" || input.length === 0) return null;

  let json: string;
  try {
    const b64 = fromBase64Url(input);
    json =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { t?: unknown }).t !== "string" ||
    typeof (parsed as { i?: unknown }).i !== "string"
  ) {
    return null;
  }

  const { t, i } = parsed as { t: string; i: string };
  if (t.length === 0 || i.length === 0) return null;
  return { t, i };
}
