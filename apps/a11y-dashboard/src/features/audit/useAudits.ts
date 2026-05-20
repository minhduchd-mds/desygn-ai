/**
 * useAudits — data access for the audit feature.
 *
 * Exposes:
 *   - `parseFileKeyFromUrl(url)` — PURE helper that pulls the Figma fileKey
 *     (and optional nodeId) out of a Figma file/design URL. Returns `null`
 *     for anything that isn't a recognizable Figma URL, so callers can treat
 *     it as a validation result rather than catching exceptions. Exported for
 *     unit testing (node env, no DOM).
 *   - `startAudit(payload)` — POST /api/a11y/audit-start.
 *   - `useAuditResult(id)` — React hook that GETs /api/a11y/audit-result?id=.
 *
 * Backend degradation: in local dev there is no API server, so `fetch` either
 * rejects (network error) or returns a non-2xx. Both paths surface as a thrown
 * `Error` from `startAudit`, and as `{ error }` (never a crash) from the hook.
 */

import { useEffect, useRef, useState } from "react";
import type { AuditSummary, WcagLevel, WcagVersion } from "@desygn/audit-engine";

/** Mirror of the figma-rest-adapter URL pattern (kept local to avoid a dep). */
const FIGMA_FILE_PATTERN = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/;

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
}

/**
 * Extract `{ fileKey, nodeId? }` from a Figma URL, or `null` when the input is
 * not a Figma file/design URL. Pure — safe to unit-test without a DOM.
 */
export function parseFileKeyFromUrl(url: string): ParsedFigmaUrl | null {
  const match = FIGMA_FILE_PATTERN.exec(url);
  if (!match) return null;

  const fileKey = match[1];
  let nodeId: string | undefined;
  try {
    const nodeIdParam = new URL(url).searchParams.get("node-id");
    if (nodeIdParam) {
      // Figma URL encoding uses "-" but the REST API uses ":".
      nodeId = nodeIdParam.replace(/-/g, ":");
    }
  } catch {
    // Ignore URL parse failures — the regex already validated the fileKey.
  }

  return nodeId ? { fileKey, nodeId } : { fileKey };
}

/** Audit-start request options surfaced by the form. */
export interface StartAuditOptions {
  wcagVersion: WcagVersion;
  wcagLevel: WcagLevel;
}

export interface StartAuditPayload {
  fileKey: string;
  nodeId?: string;
  accessToken: string;
  options: StartAuditOptions;
}

/** Shape returned by POST /api/a11y/audit-start on success. */
export interface StartAuditResponse {
  auditRunId: string;
  score: number;
  summary: AuditSummary;
  status: string;
}

/**
 * Kick off a synchronous audit. Throws on network failure or a non-2xx
 * response so callers can render an error state.
 */
export async function startAudit(
  payload: StartAuditPayload,
  signal?: AbortSignal,
): Promise<StartAuditResponse> {
  const res = await fetch("/api/a11y/audit-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "figma",
      figma: {
        fileKey: payload.fileKey,
        ...(payload.nodeId ? { nodeId: payload.nodeId } : {}),
        accessToken: payload.accessToken,
      },
      options: payload.options,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`audit-start failed: ${res.status}`);
  }
  return (await res.json()) as StartAuditResponse;
}

/** Shape returned by GET /api/a11y/audit-result?id= on success. */
export interface AuditResultResponse {
  run: Record<string, unknown>;
  issues: Array<Record<string, unknown>>;
}

export interface UseAuditResult {
  data: AuditResultResponse | null;
  error: Error | null;
  loading: boolean;
}

/** Internal: settled outcome of a request, tagged with the id it was for. */
interface AuditResultState {
  forId: string | undefined;
  data: AuditResultResponse | null;
  error: Error | null;
}

const IDLE_STATE: AuditResultState = { forId: undefined, data: null, error: null };

/**
 * Fetch a persisted audit result by id. When `id` is undefined the hook stays
 * idle (no request). Network / non-2xx failures populate `error` and never
 * throw — the dashboard degrades to an error state instead of crashing.
 *
 * State is only ever written from the async fetch callbacks (never
 * synchronously inside the effect body), so the displayed values are derived:
 * while a request for the current `id` is still in flight, the settled state's
 * `forId` won't match and we report `loading` with null data/error.
 */
export function useAuditResult(id: string | undefined): UseAuditResult {
  const [settled, setSettled] = useState<AuditResultState>(IDLE_STATE);
  const requestId = useRef(0);

  useEffect(() => {
    if (!id) {
      // Tear down any in-flight request; rendering already derives idle state
      // from the `forId` mismatch below — no synchronous setState needed.
      requestId.current += 1;
      return;
    }

    const controller = new AbortController();
    const seq = (requestId.current += 1);

    fetch(`/api/a11y/audit-result?id=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`audit-result failed: ${res.status}`);
        return (await res.json()) as AuditResultResponse;
      })
      .then((result) => {
        if (seq !== requestId.current) return; // superseded
        setSettled({ forId: id, data: result, error: null });
      })
      .catch((err: unknown) => {
        if (seq !== requestId.current || controller.signal.aborted) return;
        setSettled({
          forId: id,
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      controller.abort();
    };
  }, [id]);

  // Derive the public shape. If the settled outcome is for the current id we
  // surface it; otherwise a request is pending (loading) or we're idle.
  if (settled.forId === id && id !== undefined) {
    return { data: settled.data, error: settled.error, loading: false };
  }
  return { data: null, error: null, loading: id !== undefined };
}
